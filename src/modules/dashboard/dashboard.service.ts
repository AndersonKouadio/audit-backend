import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleUtilisateur, StatutActionPoint, StatutPoint, StatutAudit, StatutUtilisateur } from 'src/generated/prisma/enums';

// Rôles BU : leurs alertes sont filtrées par département
const ROLES_BU: string[] = [
  RoleUtilisateur.RISK_CHAMPION,
  RoleUtilisateur.MANAGER_METIER,
  RoleUtilisateur.EMPLOYE_METIER,
];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // user param accepté pour future granularité (filtrage par scope)
  // Aujourd'hui : tous les rôles voient les KPIs globaux
  async getStats(_user?: { id: string; role: string; departementId?: string }) {
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

  async getAlerts(utilisateurId: string, role?: string) {
    const maintenant = new Date();
    const dans7Jours = new Date(maintenant);
    dans7Jours.setDate(dans7Jours.getDate() + 7);
    const ilYa7Jours = new Date(maintenant);
    ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);

    // BUG-DATA-005 : Filtrer par département pour les rôles BU
    let departementFilter: { departementId?: string } = {};
    if (role && ROLES_BU.includes(role)) {
      const utilisateur = await this.prisma.utilisateur.findUnique({
        where: { id: utilisateurId },
        select: { departementId: true },
      });
      if (utilisateur?.departementId) {
        departementFilter = { departementId: utilisateur.departementId };
      }
    }

    const [
      pointsEnRetard,
      actionsEnRetard,
      validationsEnAttente,
      echeancesProches,
    ] = await Promise.all([
      this.prisma.pointAudit.findMany({
        where: {
          ...departementFilter,
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
          statut: { notIn: [StatutActionPoint.TERMINE, StatutActionPoint.ANNULEE] },
          dateEcheance: { lt: maintenant },
          ...(departementFilter.departementId
            ? { pointAudit: { departementId: departementFilter.departementId } }
            : {}),
        },
        include: {
          pointAudit: { select: { id: true, reference: true } },
        },
        take: 20,
        orderBy: { dateEcheance: 'asc' },
      }),
      this.prisma.pointAudit.findMany({
        where: {
          ...departementFilter,
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
          ...departementFilter,
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFORMANCE AUDITEUR W1 vs W2 (cahier des charges)
  // Tableau auditeur × tranches d'ageing × 2 semaines comparées
  // ═══════════════════════════════════════════════════════════════════════════

  async getPerformanceWeekly() {
    const now = new Date();
    // W1 = semaine en cours, W2 = semaine précédente
    const startW1 = new Date(now);
    startW1.setDate(now.getDate() - now.getDay()); // dimanche dernier
    startW1.setHours(0, 0, 0, 0);
    const startW2 = new Date(startW1);
    startW2.setDate(startW2.getDate() - 7);

    const auditeurs = await this.prisma.utilisateur.findMany({
      where: {
        statut: StatutUtilisateur.ACTIF,
        role: {
          in: [
            RoleUtilisateur.AUDITEUR_JUNIOR,
            RoleUtilisateur.AUDITEUR_SENIOR,
            RoleUtilisateur.CHEF_MISSION,
            RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
            RoleUtilisateur.DIRECTEUR_AUDIT,
          ],
        },
      },
      select: { id: true, nom: true, prenom: true, role: true },
    });

    const computeForWeek = async (auditorId: string, refDate: Date) => {
      const [overdue, w90, w90_180, w180_365, w365plus, futureDate, unresolved, completedNotFollow, complete] =
        await Promise.all([
          this.prisma.pointAudit.count({
            where: { createurId: auditorId, dateEcheanceActuelle: { lt: refDate }, statut: StatutPoint.OUVERT },
          }),
          this.countAgeingTranche(auditorId, refDate, 0, 90),
          this.countAgeingTranche(auditorId, refDate, 90, 180),
          this.countAgeingTranche(auditorId, refDate, 180, 365),
          this.countAgeingTranche(auditorId, refDate, 365, 99999),
          this.prisma.pointAudit.count({
            where: { createurId: auditorId, dateEcheanceActuelle: { gt: refDate } },
          }),
          this.prisma.pointAudit.count({
            where: { createurId: auditorId, statut: { in: [StatutPoint.OUVERT, StatutPoint.EN_ATTENTE_VALIDATION] } },
          }),
          this.prisma.pointAudit.count({
            where: { createurId: auditorId, statut: StatutPoint.EN_ATTENTE_VALIDATION },
          }),
          this.prisma.pointAudit.count({
            where: { createurId: auditorId, statut: { in: [StatutPoint.FERME_RESOLU, StatutPoint.FERME_RISQUE_ACCEPTE] } },
          }),
        ]);

      return { overdue, w90, w90_180, w180_365, w365plus, futureDate, unresolved, completedNotFollow, complete };
    };

    return Promise.all(
      auditeurs.map(async (a) => {
        const [w1, w2] = await Promise.all([
          computeForWeek(a.id, startW1),
          computeForWeek(a.id, startW2),
        ]);
        return {
          auditeur: { id: a.id, nom: a.nom, prenom: a.prenom, role: a.role },
          w1,
          w2,
        };
      }),
    );
  }

  private async countAgeingTranche(
    auditorId: string,
    refDate: Date,
    daysMin: number,
    daysMax: number,
  ): Promise<number> {
    const minDate = new Date(refDate);
    minDate.setDate(minDate.getDate() - daysMax);
    const maxDate = new Date(refDate);
    maxDate.setDate(maxDate.getDate() - daysMin);

    return this.prisma.pointAudit.count({
      where: {
        createurId: auditorId,
        statut: StatutPoint.OUVERT,
        dateEcheanceActuelle: { gte: minDate, lt: maxDate },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLASH HEBDOMADAIRE RÉEL (cahier des charges)
  // Liste des changements de statut sur les 7 derniers jours
  // ═══════════════════════════════════════════════════════════════════════════

  async getFlashHebdomadaire() {
    const ilYa7Jours = new Date();
    ilYa7Jours.setDate(ilYa7Jours.getDate() - 7);

    const changements = await this.prisma.historiqueStatut.findMany({
      where: {
        dateModification: { gte: ilYa7Jours },
        typeEntite: 'POINT_AUDIT',
      },
      orderBy: { dateModification: 'desc' },
      take: 100,
      include: {
        pointAudit: {
          select: {
            id: true,
            reference: true,
            titre: true,
            departement: { select: { nom: true, code: true } },
            audit: { select: { reference: true, titre: true } },
            createur: { select: { nom: true, prenom: true } },
          },
        },
      },
    });

    return changements.map((c) => ({
      pointId: c.pointAudit?.id,
      titre: c.pointAudit?.titre,
      reference: c.pointAudit?.reference,
      auditeur: c.pointAudit?.createur
        ? `${c.pointAudit.createur.prenom} ${c.pointAudit.createur.nom}`
        : null,
      direction: c.pointAudit?.departement?.nom,
      audit: c.pointAudit?.audit?.titre,
      statutPrecedent: c.statutPrecedent,
      nouveauStatut: c.nouveauStatut,
      dateModification: c.dateModification,
      modifiePar: c.modifiePar,
      commentaire: c.commentaire,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RAPPORT "RISK ACCEPTED > 1 AN" (cahier des charges)
  // Points fermés en risque accepté depuis plus d'un an
  // ═══════════════════════════════════════════════════════════════════════════

  async getRiskAcceptedAnciens() {
    const ilYa1An = new Date();
    ilYa1An.setFullYear(ilYa1An.getFullYear() - 1);

    return this.prisma.pointAudit.findMany({
      where: {
        statut: StatutPoint.FERME_RISQUE_ACCEPTE,
        dateResolution: { lt: ilYa1An },
      },
      orderBy: { dateResolution: 'asc' },
      select: {
        id: true,
        reference: true,
        titre: true,
        description: true,
        causes: true,
        consequences: true,
        recommandation: true,
        commentaireStatutBu: true,
        statut: true,
        dateResolution: true,
        ageing: true,
        departement: { select: { nom: true, code: true } },
        audit: { select: { reference: true, titre: true } },
        createur: { select: { nom: true, prenom: true } },
        formulaireRisque: {
          select: {
            numero: true,
            dateValidationFinal: true,
          },
        },
      },
    });
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
