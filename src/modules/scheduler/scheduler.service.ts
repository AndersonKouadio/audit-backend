import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatutPoint } from 'src/generated/prisma/enums';
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
    this.logger.log('🔄 Cron CPF → OPEN : démarrage...');

    const ilYa30Jours = new Date();
    ilYa30Jours.setDate(ilYa30Jours.getDate() - 30);

    const pointsExpires = await this.prisma.pointAudit.findMany({
      where: {
        statut: StatutPoint.EN_ATTENTE_VALIDATION,
        dateCPF: { lt: ilYa30Jours },
      },
      select: { id: true, reference: true, createurId: true, departementId: true },
    });

    if (pointsExpires.length === 0) {
      this.logger.log('✅ Aucun point à réinitialiser.');
      return;
    }

    this.logger.log(`⚠️ ${pointsExpires.length} point(s) à réinitialiser.`);

    await this.prisma.$transaction(async (tx) => {
      for (const point of pointsExpires) {
        // 1. Remettre au statut OUVERT
        await tx.pointAudit.update({
          where: { id: point.id },
          data: { statut: StatutPoint.OUVERT, dateCPF: null },
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

    // Notification in-app pour l'équipe
    await this.notificationsService.creer({
      destinataire: teamEmail,
      sujet: `[AUTO] ${pointsExpires.length} point(s) remis à OUVERT`,
      message: `${pointsExpires.length} point(s) ont été automatiquement remis au statut OUVERT : ${pointsExpires.map((p) => p.reference).join(', ')}`,
      type: 'RETOUR_AUTO_CPF',
      entiteType: 'POINT_AUDIT',
    });

    this.logger.log(`✅ ${pointsExpires.length} point(s) remis à OUVERT.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 2 : Relances Dunning (lundi 9h00)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 9 * * 1', { name: 'dunning-relances', timeZone: 'Africa/Abidjan' })
  async handleDunningRelances() {
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
          departement: { select: { nom: true, code: true } },
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
        await this.prisma.pointAudit.update({
          where: { id: point.id },
          data: { nbRelances: { increment: 1 } },
        });
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
    const maintenant = new Date();

    const pointsOuverts = await this.prisma.pointAudit.findMany({
      where: {
        statut: { in: [StatutPoint.OUVERT, StatutPoint.EN_ATTENTE_VALIDATION] },
        dateEcheanceActuelle: { lt: maintenant },
      },
      select: { id: true, dateEcheanceActuelle: true },
    });

    for (const point of pointsOuverts) {
      const diffMs = maintenant.getTime() - point.dateEcheanceActuelle.getTime();
      const ageing = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      await this.prisma.pointAudit.update({
        where: { id: point.id },
        data: { ageing },
      });
    }

    this.logger.log(`✅ Ageing mis à jour pour ${pointsOuverts.length} point(s).`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 4 : Traiter la file d'attente email (toutes les 15 min)
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('*/15 * * * *', { name: 'email-queue', timeZone: 'Africa/Abidjan' })
  async handleEmailQueue() {
    const { envoyes, erreurs } = await this.notificationsService.traiterFileAttente();
    if (envoyes > 0 || erreurs > 0) {
      this.logger.log(`📧 File email : ${envoyes} envoyé(s), ${erreurs} erreur(s).`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON 5 : Résumé quotidien (Daily Digest) — chaque jour à 08h00
  // ═══════════════════════════════════════════════════════════════════════════

  @Cron('0 8 * * *', { name: 'daily-digest', timeZone: 'Africa/Abidjan' })
  async handleDailyDigest() {
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
}
