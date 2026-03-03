import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatutPoint, StatutAudit, StatutUtilisateur } from 'src/generated/prisma/enums';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const maintenant = new Date();
    const ilYa6Mois = new Date(maintenant);
    ilYa6Mois.setMonth(ilYa6Mois.getMonth() - 6);

    // Toutes les requêtes en parallèle pour la performance
    const [
      totalAudits,
      auditsEnCours,
      totalPoints,
      pointsOuverts,
      pointsEnRetard,
      pointsEnValidation,
      pointsFermes,
      totalCasFraude,
      pointsParStatut,
      topDepartements,
      pointsRecents,
    ] = await Promise.all([
      this.prisma.audit.count(),
      this.prisma.audit.count({ where: { statut: 'EN_COURS' as any } }),
      this.prisma.pointAudit.count(),
      this.prisma.pointAudit.count({ where: { statut: StatutPoint.OUVERT } }),
      this.prisma.pointAudit.count({
        where: {
          statut: StatutPoint.OUVERT,
          dateEcheanceActuelle: { lt: maintenant },
        },
      }),
      this.prisma.pointAudit.count({ where: { statut: StatutPoint.EN_ATTENTE_VALIDATION } }),
      this.prisma.pointAudit.count({
        where: {
          statut: { in: [StatutPoint.FERME_RESOLU, StatutPoint.FERME_RISQUE_ACCEPTE] },
        },
      }),
      this.prisma.casFraude.count(),
      // Ageing par statut
      this.prisma.pointAudit.groupBy({
        by: ['statut'],
        _count: { statut: true },
      }),
      // Top 10 départements avec overdue
      this.prisma.departement.findMany({
        take: 10,
        include: {
          _count: {
            select: { pointsConcernes: true },
          },
        },
        orderBy: { pointsConcernes: { _count: 'desc' } },
      }),
      // Points créés et fermés par mois (6 derniers mois)
      this.prisma.pointAudit.findMany({
        where: { createdAt: { gte: ilYa6Mois } },
        select: { createdAt: true, statut: true, updatedAt: true },
      }),
    ]);

    // Calcul ageing par statut formaté
    const ageingParStatut = pointsParStatut.map((item) => ({
      statut: item.statut,
      count: item._count.statut,
    }));

    // Top départements avec calcul overdue
    const ageingParDepartement = await Promise.all(
      topDepartements.map(async (dept) => {
        const overdue = await this.prisma.pointAudit.count({
          where: {
            departementId: dept.id,
            statut: StatutPoint.OUVERT,
            dateEcheanceActuelle: { lt: maintenant },
          },
        });
        return {
          departementCode: dept.code,
          departementNom: dept.nom,
          total: dept._count.pointsConcernes,
          overdue,
        };
      }),
    );

    // Évolution mensuelle sur 6 mois
    const evolutionMensuelle = this.calculerEvolutionMensuelle(pointsRecents, ilYa6Mois);

    return {
      totalAudits,
      auditsEnCours,
      totalPoints,
      pointsOuverts,
      pointsEnRetard,
      pointsEnValidation,
      pointsFermes,
      totalCasFraude,
      ageingParStatut,
      ageingParDepartement: ageingParDepartement.sort((a, b) => b.total - a.total),
      evolutionMensuelle,
    };
  }

  async getPerformance() {
    const utilisateurs = await this.prisma.utilisateur.findMany({
      where: { statut: StatutUtilisateur.ACTIF },
      select: {
        id: true,
        nom: true,
        prenom: true,
        role: true,
      },
    });

    const result = await Promise.all(
      utilisateurs.map(async (u) => {
        const [totalAudits, auditsEnCours, auditsClos, totalPointsCrees, pointsFermes, pointsEnAttente] = await Promise.all([
          this.prisma.audit.count({ where: { responsableId: u.id } }),
          this.prisma.audit.count({
            where: { responsableId: u.id, statut: StatutAudit.EN_COURS },
          }),
          this.prisma.audit.count({
            where: {
              responsableId: u.id,
              statut: { in: [StatutAudit.CLOTURE, StatutAudit.ARCHIVE] },
            },
          }),
          this.prisma.pointAudit.count({ where: { createurId: u.id } }),
          this.prisma.pointAudit.count({
            where: {
              createurId: u.id,
              statut: { in: [StatutPoint.FERME_RESOLU, StatutPoint.FERME_RISQUE_ACCEPTE] },
            },
          }),
          this.prisma.pointAudit.count({
            where: { createurId: u.id, statut: StatutPoint.EN_ATTENTE_VALIDATION },
          }),
        ]);

        const tauxCloture = totalPointsCrees > 0 ? Math.round((pointsFermes / totalPointsCrees) * 100) : 0;

        return {
          utilisateurId: u.id,
          nom: u.nom,
          prenom: u.prenom,
          role: u.role,
          totalAudits,
          auditsEnCours,
          auditsClos,
          totalPointsCrees,
          pointsFermes,
          pointsEnAttente,
          tauxCloture,
        };
      }),
    );

    // Filtrer uniquement ceux qui ont au moins 1 activité
    return result
      .filter((u) => u.totalAudits > 0 || u.totalPointsCrees > 0)
      .sort((a, b) => b.tauxCloture - a.tauxCloture);
  }

  async getAlerts(_utilisateurId: string) {
    const maintenant = new Date();
    const dans7Jours = new Date(maintenant);
    dans7Jours.setDate(dans7Jours.getDate() + 7);
    const ilYa7Jours = new Date(maintenant);
    ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);

    const [
      pointsEnRetard,
      actionsEnRetard,
      validationsEnAttente,
      echeancesProches,
    ] = await Promise.all([
      this.prisma.pointAudit.findMany({
        where: {
          statut: StatutPoint.OUVERT,
          dateEcheanceActuelle: { lt: maintenant },
        },
        select: {
          id: true,
          reference: true,
          titre: true,
          dateEcheanceActuelle: true,
          audit: { select: { reference: true } },
        },
        take: 20,
        orderBy: { dateEcheanceActuelle: 'asc' },
      }),
      this.prisma.actionPoint.findMany({
        where: {
          statut: { notIn: ['TERMINE', 'ANNULEE'] as any },
          dateEcheance: { lt: maintenant },
        },
        include: {
          pointAudit: { select: { id: true, reference: true } },
        },
        take: 20,
        orderBy: { dateEcheance: 'asc' },
      }),
      this.prisma.pointAudit.findMany({
        where: {
          statut: StatutPoint.EN_ATTENTE_VALIDATION,
          updatedAt: { lt: ilYa7Jours },
        },
        select: {
          id: true,
          reference: true,
          titre: true,
          updatedAt: true,
          audit: { select: { reference: true } },
        },
        take: 20,
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.pointAudit.findMany({
        where: {
          statut: StatutPoint.OUVERT,
          dateEcheanceActuelle: {
            gte: maintenant,
            lte: dans7Jours,
          },
        },
        select: {
          id: true,
          reference: true,
          titre: true,
          dateEcheanceActuelle: true,
          audit: { select: { reference: true } },
        },
        take: 20,
        orderBy: { dateEcheanceActuelle: 'asc' },
      }),
    ]);

    const alerts: any[] = [];

    pointsEnRetard.forEach((p) => {
      alerts.push({
        type: 'POINT_EN_RETARD',
        entiteId: p.id,
        entiteRef: p.reference,
        titre: p.titre,
        date: p.dateEcheanceActuelle,
        lien: `/dashboard/points-audit/${p.id}`,
        auditRef: p.audit?.reference,
      });
    });

    actionsEnRetard.forEach((a) => {
      alerts.push({
        type: 'ACTION_EN_RETARD',
        entiteId: a.id,
        entiteRef: a.pointAudit?.reference,
        titre: a.description,
        date: a.dateEcheance,
        lien: `/dashboard/points-audit/${a.pointAuditId}`,
      });
    });

    validationsEnAttente.forEach((p) => {
      alerts.push({
        type: 'VALIDATION_EN_ATTENTE',
        entiteId: p.id,
        entiteRef: p.reference,
        titre: p.titre,
        date: p.updatedAt,
        lien: `/dashboard/points-audit/${p.id}`,
        auditRef: p.audit?.reference,
      });
    });

    echeancesProches.forEach((p) => {
      alerts.push({
        type: 'ECHEANCE_PROCHE',
        entiteId: p.id,
        entiteRef: p.reference,
        titre: p.titre,
        date: p.dateEcheanceActuelle,
        lien: `/dashboard/points-audit/${p.id}`,
        auditRef: p.audit?.reference,
      });
    });

    return alerts;
  }

  private calculerEvolutionMensuelle(points: any[], _depuis: Date): Array<{ mois: string; crees: number; fermes: number }> {
    const maintenant = new Date();
    const resultat: Array<{ mois: string; crees: number; fermes: number }> = [];

    for (let i = 5; i >= 0; i--) {
      const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
      const finMois = new Date(maintenant.getFullYear(), maintenant.getMonth() - i + 1, 0, 23, 59, 59);
      const labelMois = debutMois.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

      const crees = points.filter(
        (p) => p.createdAt >= debutMois && p.createdAt <= finMois,
      ).length;

      const fermes = points.filter(
        (p) =>
          p.updatedAt >= debutMois &&
          p.updatedAt <= finMois &&
          (p.statut === StatutPoint.FERME_RESOLU || p.statut === StatutPoint.FERME_RISQUE_ACCEPTE),
      ).length;

      resultat.push({ mois: labelMois, crees, fermes });
    }

    return resultat;
  }
}
