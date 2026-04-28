import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatutActionPoint, StatutPoint } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailService } from 'src/modules/mailer/email.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';
import { ParametresSystemeService } from 'src/modules/parametres-systeme/parametres-systeme.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly parametresService: ParametresSystemeService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 1 : Retour automatique CPF → OUVERT (lundi 8h00)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 8 * * 1', { name: 'cpf-auto-revert', timeZone: 'Africa/Abidjan' })
  async handleCpfAutoRevert() {
    try {
      await this._handleCpfAutoRevertImpl();
    } catch (err) {
      this.logger.error(
        `❌ Cron cpf-auto-revert a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async _handleCpfAutoRevertImpl() {
    this.logger.log('🔄 Cron CPF → OPEN : démarrage...');

    const ilYa30Jours = new Date();
    ilYa30Jours.setDate(ilYa30Jours.getDate() - 30);

    const pointsExpires = await this.prisma.pointAudit.findMany({
      where: {
        statut: StatutPoint.EN_ATTENTE_VALIDATION,
        dateCPF: { lt: ilYa30Jours },
      },
      select: {
        id: true,
        reference: true,
        titre: true,
        createurId: true,
        departementId: true,
        createur: { select: { id: true, email: true } },
        departement: {
          select: {
            riskChampionId: true,
            riskChampion: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (pointsExpires.length === 0) {
      this.logger.log('✅ Aucun point à réinitialiser.');
      return;
    }

    this.logger.log(`⚠️ ${pointsExpires.length} point(s) à réinitialiser.`);

    await this.prisma.$transaction(async (tx) => {
      for (const point of pointsExpires) {
        // 1. Remettre au statut OUVERT + réinitialiser le statut BU
        await tx.pointAudit.update({
          where: { id: point.id },
          data: {
            statut: StatutPoint.OUVERT,
            dateCPF: null,
            statutBu: StatutPoint.OUVERT,
            commentaireStatutBu: null,
          } as any,
        });

        // 2. Historique
        await tx.historiqueStatut.create({
          data: {
            typeEntite: 'POINT_AUDIT',
            entiteId: point.id,
            statutPrecedent: StatutPoint.EN_ATTENTE_VALIDATION,
            nouveauStatut: StatutPoint.OUVERT,
            commentaire: 'Retour automatique : délai de 30 jours dépassé sans validation audit.',
            modifiePar: 'SYSTÈME_CRON',
            pointAuditId: point.id,
          },
        });
      }
    });

    // 3. Email et notification vers l'équipe Audit
    const teamEmail = process.env.AUDIT_TEAM_EMAIL ?? 'team-audit@organisation.ci';
    const emailHtml = this.emailService.buildRetourCpfTemplate({
      reference: pointsExpires.map((p) => p.reference).join(', '),
    });

    await this.emailService.sendEmail({
      to: teamEmail,
      subject: `[AUTO] ${pointsExpires.length} point(s) remis à OUVERT après 30 jours CPF`,
      html: emailHtml,
    });

    // Notification in-app pour l'équipe (digest global)
    await this.notificationsService.creer({
      destinataire: teamEmail,
      sujet: `[AUTO] ${pointsExpires.length} point(s) remis à OUVERT`,
      message: `${pointsExpires.length} point(s) ont été automatiquement remis au statut OUVERT : ${pointsExpires.map((p) => p.reference).join(', ')}`,
      type: 'RETOUR_AUTO_CPF',
      entiteType: 'POINT_AUDIT',
    });

    // 📬 Notification individuelle (in-app push) à chaque créateur + risk champion concerné
    for (const p of pointsExpires) {
      const targets = new Map<string, string>();
      if (p.createur) targets.set(p.createur.id, p.createur.email);
      if (p.departement?.riskChampion) {
        targets.set(p.departement.riskChampion.id, p.departement.riskChampion.email);
      }
      for (const [userId, email] of targets) {
        try {
          await this.notificationsService.creer({
            destinataire: email,
            utilisateurId: userId,
            sujet: `[CPF EXPIRÉ] ${p.reference} remis à OUVERT`,
            message: `Le point ${p.reference} - ${p.titre} a été automatiquement remis à OUVERT (30 jours sans validation audit). Veuillez le traiter.`,
            type: 'RETOUR_AUTO_CPF',
            entiteType: 'POINT_AUDIT',
            entiteId: p.id,
          });
        } catch (err) {
          this.logger.warn(`Échec notif CPF user ${userId}: ${(err as Error).message}`);
        }
      }
    }

    this.logger.log(`✅ ${pointsExpires.length} point(s) remis à OUVERT + notifs individuelles.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 2 : Relances Dunning (lundi 9h00)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 9 * * 1', { name: 'dunning-relances', timeZone: 'Africa/Abidjan' })
  async handleDunningRelances() {
    try {
      await this._handleDunningRelancesImpl();
    } catch (err) {
      this.logger.error(
        `❌ Cron dunning-relances a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async _handleDunningRelancesImpl() {
    // Vérifier que le dunning est activé dans les paramètres système
    const params = await this.parametresService.obtenir();
    if (!params.dunningActif) {
      this.logger.log('⏭️  Cron Dunning : désactivé dans les paramètres système. Ignoré.');
      return;
    }

    this.logger.log('📧 Cron Dunning : démarrage...');

    const maintenant = new Date();

    const planifications = await this.prisma.planificationDunning.findMany({
      where: {
        actif: true,
        OR: [{ nextRun: { lte: maintenant } }, { nextRun: null }],
      },
    });

    for (const plan of planifications) {
      const pointsEnRetard = await this.prisma.pointAudit.findMany({
        where: {
          statut: StatutPoint.OUVERT,
          dateEcheanceActuelle: { lt: maintenant },
        },
        include: {
          departement: {
            select: {
              nom: true,
              code: true,
              riskChampion: { select: { id: true, email: true } },
              employes: {
                where: { role: 'MANAGER_METIER' },
                select: { id: true, email: true },
              },
            },
          },
          audit: {
            select: {
              responsable: { select: { id: true, email: true } },
            },
          },
          createur: { select: { id: true, email: true, nom: true, prenom: true } },
        },
        take: 50,
      });

      let relancesEnvoyees = 0;

      for (const point of pointsEnRetard) {
        const emailHtml = this.emailService.buildRelanceTemplate({
          reference: point.reference,
          titre: point.titre,
          dateEcheance: point.dateEcheanceActuelle.toLocaleDateString('fr-FR'),
          destinataire: point.createur.email,
        });

        const ok = await this.emailService.sendEmail({
          to: point.createur.email,
          subject: `[RELANCE] Point d'audit en retard — ${point.reference}`,
          html: emailHtml,
        });

        if (ok) relancesEnvoyees++;

        // Notification in-app liée à l'utilisateur
        await this.notificationsService.creer({
          destinataire: point.createur.email,
          sujet: `[RELANCE] Point d'audit en retard — ${point.reference}`,
          message: `Le constat "${point.titre}" (${point.reference}) est en retard. Échéance dépassée : ${point.dateEcheanceActuelle.toLocaleDateString('fr-FR')}.`,
          type: 'RELANCE_DUNNING',
          utilisateurId: point.createur.id,
          entiteType: 'POINT_AUDIT',
          entiteId: point.id,
        });

        // Incrémenter le compteur de relances
        const updated = await this.prisma.pointAudit.update({
          where: { id: point.id },
          data: { nbRelances: { increment: 1 } },
          select: { nbRelances: true },
        });

        // 🔼 Escalade au manager BU + chef mission après 3 relances sans réponse
        if (updated.nbRelances >= 3) {
          const escaladeTargets = new Map<string, string>();
          // Risk Champion
          if (point.departement?.riskChampion) {
            escaladeTargets.set(
              point.departement.riskChampion.id,
              point.departement.riskChampion.email,
            );
          }
          // Manager(s) BU du dept
          for (const m of point.departement?.employes ?? []) {
            escaladeTargets.set(m.id, m.email);
          }
          // Chef de mission
          if (point.audit?.responsable) {
            escaladeTargets.set(point.audit.responsable.id, point.audit.responsable.email);
          }

          for (const [userId, email] of escaladeTargets) {
            try {
              await this.notificationsService.creer({
                destinataire: email,
                utilisateurId: userId,
                sujet: `[ESCALADE] ${point.reference} - ${updated.nbRelances} relances sans réponse`,
                message: `Le constat ${point.reference} - ${point.titre} a fait l'objet de ${updated.nbRelances} relances sans réponse de l'audité. Une intervention managériale est requise. Échéance dépassée depuis le ${point.dateEcheanceActuelle.toLocaleDateString('fr-FR')}.`,
                type: 'ESCALADE_DUNNING',
                entiteType: 'POINT_AUDIT',
                entiteId: point.id,
              });
            } catch (err) {
              this.logger.warn(`Échec notif escalade user ${userId}: ${(err as Error).message}`);
            }
          }
        }
      }

      // Prochaine exécution
      const prochainRun = new Date(maintenant);
      if (plan.frequence === 'HEBDOMADAIRE') {
        prochainRun.setDate(prochainRun.getDate() + 7);
      } else if (plan.frequence === 'MENSUEL') {
        prochainRun.setMonth(prochainRun.getMonth() + 1);
      }

      await this.prisma.planificationDunning.update({
        where: { id: plan.id },
        data: { lastRun: maintenant, nextRun: prochainRun },
      });

      this.logger.log(
        `✅ Dunning plan ${plan.id} : ${relancesEnvoyees}/${pointsEnRetard.length} relances envoyées.`,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 3 : Mise à jour de l'ageing (tous les jours à minuit)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'ageing-update', timeZone: 'Africa/Abidjan' })
  async handleAgeingUpdate() {
    try {
      await this._handleAgeingUpdateImpl();
    } catch (err) {
      this.logger.error(
        `❌ Cron ageing-update a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  /**
   * Détermine la tranche d'ageing d'un point.
   * Tranches du cahier des charges : <90j / 90-180 / 180-365 / >365
   */
  private getAgeingTranche(ageing: number): string {
    if (ageing < 90) return '<90j';
    if (ageing < 180) return '90-180j';
    if (ageing < 365) return '180-365j';
    return '>365j';
  }

  private async _handleAgeingUpdateImpl() {
    const maintenant = new Date();

    const pointsOuverts = await this.prisma.pointAudit.findMany({
      where: {
        statut: { in: [StatutPoint.OUVERT, StatutPoint.EN_ATTENTE_VALIDATION] },
        dateEcheanceActuelle: { lt: maintenant },
      },
      select: {
        id: true,
        reference: true,
        titre: true,
        ageing: true,
        dateEcheanceActuelle: true,
        createurId: true,
        departement: {
          select: {
            riskChampion: { select: { id: true, email: true } },
          },
        },
        createur: { select: { id: true, email: true } },
      },
    });

    let basculements = 0;
    for (const point of pointsOuverts) {
      const diffMs = maintenant.getTime() - point.dateEcheanceActuelle.getTime();
      const nouvelAgeing = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const ancienneTranche = this.getAgeingTranche(point.ageing);
      const nouvelleTranche = this.getAgeingTranche(nouvelAgeing);

      await this.prisma.pointAudit.update({
        where: { id: point.id },
        data: { ageing: nouvelAgeing },
      });

      // 🔔 Si la tranche change (ex: <90j → 90-180j), notifier les acteurs
      if (ancienneTranche !== nouvelleTranche) {
        basculements += 1;
        const targets = new Map<string, string>();
        if (point.createur) targets.set(point.createur.id, point.createur.email);
        if (point.departement?.riskChampion) {
          targets.set(point.departement.riskChampion.id, point.departement.riskChampion.email);
        }
        for (const [userId, email] of targets) {
          try {
            await this.notificationsService.creer({
              destinataire: email,
              utilisateurId: userId,
              sujet: `[AGEING] ${point.reference} → ${nouvelleTranche}`,
              message: `Le constat ${point.reference} - ${point.titre} a basculé de la tranche d'ageing "${ancienneTranche}" à "${nouvelleTranche}" (${nouvelAgeing} jours de retard). Une intervention est recommandée.`,
              type: 'AGEING_TRANCHE_CHANGE',
              entiteType: 'POINT_AUDIT',
              entiteId: point.id,
            });
          } catch (err) {
            this.logger.warn(`Échec notif tranche ageing: ${(err as Error).message}`);
          }
        }
      }
    }

    this.logger.log(
      `✅ Ageing mis à jour pour ${pointsOuverts.length} point(s) — ${basculements} basculement(s) de tranche.`,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 4 : Traiter la file d'attente email (toutes les 15 min)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('*/15 * * * *', { name: 'email-queue', timeZone: 'Africa/Abidjan' })
  async handleEmailQueue() {
    try {
      const { envoyes, erreurs } = await this.notificationsService.traiterFileAttente();
      if (envoyes > 0 || erreurs > 0) {
        this.logger.log(`📧 File email : ${envoyes} envoyé(s), ${erreurs} erreur(s).`);
      }
    } catch (err) {
      this.logger.error(
        `❌ Cron email-queue a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 5 : Résumé quotidien (Daily Digest) — chaque jour à 08h00
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 6 : Rappel échéance proche pour actions (J-7) — chaque jour à 8h30
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('30 8 * * *', { name: 'action-deadline-reminders', timeZone: 'Africa/Abidjan' })
  async handleActionDeadlineReminders() {
    try {
      // 3 rappels échelonnés : J-7, J-3, J-1
      await this._handleActionDeadlineImpl(7);
      await this._handleActionDeadlineImpl(3);
      await this._handleActionDeadlineImpl(1);
    } catch (err) {
      this.logger.error(
        `❌ Cron action-deadline-reminders a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async _handleActionDeadlineImpl(daysAhead: number) {
    const maintenant = new Date();
    const debut = new Date(maintenant);
    debut.setDate(debut.getDate() + daysAhead - 1);
    const fin = new Date(maintenant);
    fin.setDate(fin.getDate() + daysAhead);

    // Actions arrivant à échéance dans exactement N jours et non terminées
    const actions = await this.prisma.actionPoint.findMany({
      where: {
        dateEcheance: { gte: debut, lt: fin },
        statut: { notIn: [StatutActionPoint.TERMINE, StatutActionPoint.ANNULEE] },
      },
      include: {
        responsable: { select: { id: true, email: true } },
        pointAudit: {
          select: {
            reference: true,
            titre: true,
            departement: {
              select: {
                riskChampion: { select: { id: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (actions.length === 0) {
      this.logger.log(`✅ Aucune action à rappeler (J-${daysAhead}).`);
      return;
    }

    // Niveau d'urgence selon la proximité
    const urgence = daysAhead === 1 ? 'URGENT' : daysAhead === 3 ? 'IMPORTANT' : 'RAPPEL';

    for (const action of actions) {
      const targets = new Map<string, string>();
      if (action.responsable) targets.set(action.responsable.id, action.responsable.email);
      if (action.pointAudit?.departement?.riskChampion) {
        targets.set(
          action.pointAudit.departement.riskChampion.id,
          action.pointAudit.departement.riskChampion.email,
        );
      }
      for (const [userId, email] of targets) {
        await this.notificationsService.creer({
          destinataire: email,
          utilisateurId: userId,
          sujet: `[${urgence} J-${daysAhead}] ${action.pointAudit?.reference}`,
          message: `${urgence} : Une action corrective sur le constat ${action.pointAudit?.reference} - ${action.pointAudit?.titre} arrive à échéance dans ${daysAhead} jour${daysAhead > 1 ? 's' : ''} (${new Date(action.dateEcheance).toLocaleDateString('fr-FR')}).`,
          type: 'ECHEANCE_PROCHE_ACTION',
          entiteType: 'ACTION_POINT',
          entiteId: action.id,
        });
      }
    }

    this.logger.log(`✅ ${actions.length} action(s) avec rappel J-7 envoyé.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 5 : Résumé quotidien (Daily Digest) — chaque jour à 08h00
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 8 * * *', { name: 'daily-digest', timeZone: 'Africa/Abidjan' })
  async handleDailyDigest() {
    try {
      await this._handleDailyDigestImpl();
    } catch (err) {
      this.logger.error(
        `❌ Cron daily-digest a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async _handleDailyDigestImpl() {
    const params = await this.parametresService.obtenir();

    if (!params.resumeQuotidienActif) {
      this.logger.log('⏭️  Cron Daily Digest : désactivé dans les paramètres système. Ignoré.');
      return;
    }

    this.logger.log('📊 Cron Daily Digest : démarrage...');

    const maintenant = new Date();

    // Calculer les KPIs en parallèle
    const [totalPoints, pointsEnRetard, pointsEnValidation, pointsFermes] = await Promise.all([
      this.prisma.pointAudit.count(),
      this.prisma.pointAudit.count({
        where: {
          statut: StatutPoint.OUVERT,
          dateEcheanceActuelle: { lt: maintenant },
        },
      }),
      this.prisma.pointAudit.count({
        where: { statut: StatutPoint.EN_ATTENTE_VALIDATION },
      }),
      this.prisma.pointAudit.count({
        where: {
          statut: { in: [StatutPoint.FERME_RESOLU, StatutPoint.FERME_RISQUE_ACCEPTE] },
        },
      }),
    ]);

    const dateLabel = maintenant.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const teamEmail = process.env.AUDIT_TEAM_EMAIL ?? 'team-audit@organisation.ci';
    const html = this.emailService.buildDailyDigestTemplate({
      totalPoints,
      pointsEnRetard,
      pointsEnValidation,
      pointsFermes,
      date: dateLabel,
    });

    await this.emailService.sendEmail({
      to: teamEmail,
      subject: `[Digest] Résumé quotidien Audit — ${dateLabel}`,
      html,
    });

    this.logger.log(`✅ Daily Digest envoyé à ${teamEmail} (${totalPoints} points, ${pointsEnRetard} en retard).`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 7 : Nettoyage des notifications anciennes (dimanche 3h, hebdo)
  // Purge les notifications envoyées il y a > 90 jours pour limiter la taille de la table
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 3 * * 0', { name: 'cleanup-notifications', timeZone: 'Africa/Abidjan' })
  async handleCleanupNotifications() {
    try {
      const ilYa90Jours = new Date();
      ilYa90Jours.setDate(ilYa90Jours.getDate() - 90);

      const { count } = await this.prisma.notification.deleteMany({
        where: {
          OR: [
            // Notifications envoyées et lues depuis > 90j
            { statut: 'ENVOYE', lu: true, createdAt: { lt: ilYa90Jours } },
            // Notifications en erreur permanente depuis > 90j (nettoyage)
            { statut: 'ERREUR_PERMANENTE', createdAt: { lt: ilYa90Jours } },
          ],
        },
      });

      this.logger.log(`🧹 Nettoyage notifs : ${count} notification(s) supprimée(s) (>90j).`);
    } catch (err) {
      this.logger.error(
        `❌ Cron cleanup-notifications a échoué : ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
