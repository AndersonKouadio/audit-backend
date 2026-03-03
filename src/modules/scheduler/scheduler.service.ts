import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatutPoint } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Chaque lundi à 8h00 :
   * Retour automatique CPF → OPEN pour les points en attente depuis > 30 jours
   */
  @Cron('0 8 * * 1', { name: 'cpf-auto-revert', timeZone: 'Africa/Abidjan' })
  async handleCpfAutoRevert() {
    this.logger.log('🔄 Cron CPF → OPEN : démarrage...');

    const ilYa30Jours = new Date();
    ilYa30Jours.setDate(ilYa30Jours.getDate() - 30);

    // Trouver tous les points EN_ATTENTE_VALIDATION depuis plus de 30 jours
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

    // Transaction : mettre à jour + créer historique + créer notifications
    await this.prisma.$transaction(async (tx) => {
      for (const point of pointsExpires) {
        // 1. Remettre au statut OUVERT
        await tx.pointAudit.update({
          where: { id: point.id },
          data: {
            statut: StatutPoint.OUVERT,
            dateCPF: null,
          },
        });

        // 2. Créer une entrée d'historique
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

        // 3. Créer une notification
        await tx.notification.create({
          data: {
            destinataire: 'team-audit@organisation.ci',
            sujet: `Retour automatique — Point ${point.reference}`,
            message: `Le point d'audit ${point.reference} a été automatiquement remis au statut OUVERT après 30 jours sans validation.`,
            type: 'RETOUR_AUTO_CPF',
            statut: 'EN_ATTENTE',
          },
        });
      }
    });

    this.logger.log(`✅ ${pointsExpires.length} point(s) remis à OUVERT.`);
  }

  /**
   * Chaque lundi à 9h00 :
   * Envoi des relances dunning pour les points en retard
   */
  @Cron('0 9 * * 1', { name: 'dunning-relances', timeZone: 'Africa/Abidjan' })
  async handleDunningRelances() {
    this.logger.log('📧 Cron Dunning : démarrage...');

    const maintenant = new Date();

    // Trouver les planifications actives dont le nextRun est passé
    const planifications = await this.prisma.planificationDunning.findMany({
      where: {
        actif: true,
        OR: [{ nextRun: { lte: maintenant } }, { nextRun: null }],
      },
    });

    for (const plan of planifications) {
      // Points en retard concernés
      const pointsEnRetard = await this.prisma.pointAudit.findMany({
        where: {
          statut: StatutPoint.OUVERT,
          dateEcheanceActuelle: { lt: maintenant },
        },
        include: {
          departement: { select: { nom: true, code: true } },
          createur: { select: { email: true, nom: true, prenom: true } },
        },
        take: 50,
      });

      if (pointsEnRetard.length > 0) {
        // Créer les notifications de relance
        await this.prisma.$transaction(
          pointsEnRetard.map((point) =>
            this.prisma.notification.create({
              data: {
                destinataire: point.createur.email,
                sujet: `[RELANCE] Point d'audit en retard — ${point.reference}`,
                message: `Le point d'audit "${point.titre}" (${point.reference}) est en retard. Échéance initiale : ${point.dateEcheanceActuelle.toLocaleDateString('fr-FR')}. Merci de mettre à jour le statut.`,
                type: 'RELANCE_DUNNING',
                statut: 'EN_ATTENTE',
              },
            }),
          ),
        );
      }

      // Calculer la prochaine exécution
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
        `✅ Dunning plan ${plan.id} : ${pointsEnRetard.length} relances créées.`,
      );
    }
  }

  /**
   * Chaque jour à minuit : mise à jour de l'ageing des points
   */
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
}
