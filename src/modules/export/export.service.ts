import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from 'src/prisma/prisma.service';
import { StatutPoint } from 'src/generated/prisma/enums';

const NIVEAU_RISQUE = (score: number) => {
  if (score <= 4) return 'Faible';
  if (score <= 9) return 'Modéré';
  if (score <= 16) return 'Élevé';
  return 'Critique';
};

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async exportPointsAudit(filters?: { auditId?: string; statut?: string; departementId?: string }): Promise<Buffer> {
    const where: any = {};
    if (filters?.auditId) where.auditId = filters.auditId;
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.departementId) where.departementId = filters.departementId;

    const points = await this.prisma.pointAudit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        audit: { select: { reference: true, titre: true } },
        departement: { select: { code: true, nom: true } },
        createur: { select: { nom: true, prenom: true } },
      },
      take: 5000, // Limite de sécurité
    });

    const lignes = points.map((p) => ({
      Référence: p.reference,
      Titre: p.titre,
      'Mission Audit': p.audit ? `${p.audit.reference} - ${p.audit.titre}` : '',
      Département: p.departement ? `${p.departement.code} - ${p.departement.nom}` : '',
      Criticité: p.criticite,
      Statut: p.statut,
      Description: p.description,
      'Cause Racine': p.causes || '',
      Conséquences: p.consequences || '',
      Recommandation: p.recommandation,
      'Date Échéance Initiale': p.dateEcheanceInitiale
        ? new Date(p.dateEcheanceInitiale).toLocaleDateString('fr-FR')
        : '',
      'Date Échéance Actuelle': p.dateEcheanceActuelle
        ? new Date(p.dateEcheanceActuelle).toLocaleDateString('fr-FR')
        : '',
      'Ageing (jours)': p.ageing,
      'Nb Relances': p.nbRelances,
      Créateur: p.createur ? `${p.createur.prenom} ${p.createur.nom}` : '',
      'Date Création': new Date(p.createdAt).toLocaleDateString('fr-FR'),
    }));

    const ws = XLSX.utils.json_to_sheet(lignes);
    // Auto-largeur colonnes
    ws['!cols'] = Object.keys(lignes[0] || {}).map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Points d'Audit");

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportCasFraude(filters?: { statut?: string; departementId?: string }): Promise<Buffer> {
    const where: any = {};
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.departementId) where.departementId = filters.departementId;

    const cas = await this.prisma.casFraude.findMany({
      where,
      orderBy: { dateSignalement: 'desc' },
      include: {
        departement: { select: { code: true, nom: true } },
        auditeurFRM: { select: { nom: true, prenom: true } },
        _count: { select: { points: true } },
      },
      take: 5000,
    });

    const lignes = cas.map((c) => ({
      'Numéro Cas': c.numeroCas,
      Titre: c.titre,
      Description: c.description,
      Département: c.departement ? `${c.departement.code} - ${c.departement.nom}` : '',
      'Date Signalement': new Date(c.dateSignalement).toLocaleDateString('fr-FR'),
      'Coût Impact (FCFA)': c.coutImpact?.toString() || '',
      Statut: c.statut,
      'Auditeur FRM': c.auditeurFRM ? `${c.auditeurFRM.prenom} ${c.auditeurFRM.nom}` : '',
      'Nb Points': c._count.points,
      'Date Création': new Date(c.createdAt).toLocaleDateString('fr-FR'),
    }));

    const ws = XLSX.utils.json_to_sheet(lignes);
    ws['!cols'] = Object.keys(lignes[0] || {}).map(() => ({ wch: 22 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cas de Fraude FRM');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportAgeing(): Promise<Buffer> {
    const maintenant = new Date();

    const points = await this.prisma.pointAudit.findMany({
      where: {
        statut: { in: [StatutPoint.OUVERT, StatutPoint.EN_ATTENTE_VALIDATION] },
      },
      include: {
        departement: { select: { code: true, nom: true } },
        audit: { select: { reference: true } },
      },
      orderBy: { ageing: 'desc' },
    });

    const lignes = points.map((p) => {
      const ageingJours = p.ageing;
      let trancheAgeing = '';
      if (ageingJours <= 0) trancheAgeing = 'Non échu';
      else if (ageingJours <= 90) trancheAgeing = '< 90 jours';
      else if (ageingJours <= 180) trancheAgeing = '90-180 jours';
      else if (ageingJours <= 365) trancheAgeing = '180-365 jours';
      else trancheAgeing = '> 365 jours';

      return {
        Référence: p.reference,
        Titre: p.titre,
        Mission: p.audit?.reference || '',
        Département: p.departement ? `${p.departement.code} - ${p.departement.nom}` : '',
        Statut: p.statut,
        Criticité: p.criticite,
        'Date Échéance': p.dateEcheanceActuelle
          ? new Date(p.dateEcheanceActuelle).toLocaleDateString('fr-FR')
          : '',
        'Ageing (jours)': ageingJours,
        'Tranche Ageing': trancheAgeing,
      };
    });

    const ws = XLSX.utils.json_to_sheet(lignes);
    ws['!cols'] = Object.keys(lignes[0] || {}).map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport Ageing');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async exportRisques(): Promise<Buffer> {
    const risques = await this.prisma.risque.findMany({
      orderBy: { score: 'desc' },
      include: {
        departement: { select: { code: true, nom: true } },
        responsable: { select: { nom: true, prenom: true } },
      },
      take: 5000,
    });

    const lignes = risques.map((r) => ({
      Référence: r.reference,
      Titre: r.titre,
      Catégorie: r.categorie,
      Probabilité: r.probabilite,
      Impact: r.impact,
      Score: r.score,
      Niveau: NIVEAU_RISQUE(r.score),
      Département: r.departement ? `${r.departement.code} - ${r.departement.nom}` : '',
      Responsable: r.responsable ? `${r.responsable.prenom} ${r.responsable.nom}` : '',
      Statut: r.statut,
      'Date Révision': r.dateProchaineRevue
        ? new Date(r.dateProchaineRevue).toLocaleDateString('fr-FR')
        : '',
    }));

    const ws = XLSX.utils.json_to_sheet(lignes);
    ws['!cols'] = Object.keys(lignes[0] || {}).map(() => ({ wch: 20 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registre des Risques');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
