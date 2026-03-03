import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatutPoint } from 'src/generated/prisma/enums';

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

  private calculerEvolutionMensuelle(points: any[], depuis: Date): Array<{ mois: string; crees: number; fermes: number }> {
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
