import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePointAuditDto } from './dto/create-points-audit.dto';
import { PointQueryDto } from './dto/point-query.dto';
import { UpdatePointsAuditDto } from './dto/update-points-audit.dto';
import { PointAudit } from 'src/generated/prisma/client';
import { JournalAuditService } from '../journal-audit/journal-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RoleUtilisateur, StatutAudit, StatutPoint, TypeActionLog } from 'src/generated/prisma/enums';

export interface UserContext {
  id: string;
  nom: string;
  role: string;
  departementId?: string;
}

// ─── Constantes de rôles ───────────────────────────────────────────────────
const ROLES_BU: string[] = [
  RoleUtilisateur.RISK_CHAMPION,
  RoleUtilisateur.MANAGER_METIER,
  RoleUtilisateur.EMPLOYE_METIER,
];

const ROLES_AUDIT: string[] = [
  RoleUtilisateur.ADMIN,
  RoleUtilisateur.DIRECTEUR_AUDIT,
  RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  RoleUtilisateur.CHEF_MISSION,
  RoleUtilisateur.AUDITEUR_SENIOR,
  RoleUtilisateur.AUDITEUR_JUNIOR,
  RoleUtilisateur.STAGIAIRE,
];

// Statuts que la BU est autorisée à déclarer
const STATUTS_AUTORISES_BU: StatutPoint[] = [
  StatutPoint.OUVERT,
  StatutPoint.EN_ATTENTE_VALIDATION,
];

// Machine d'état : transitions autorisées par statut officiel
const TRANSITIONS_AUTORISEES: Partial<Record<StatutPoint, StatutPoint[]>> = {
  [StatutPoint.OUVERT]: [StatutPoint.EN_ATTENTE_VALIDATION, StatutPoint.OBSOLETE],
  [StatutPoint.EN_ATTENTE_VALIDATION]: [
    StatutPoint.FERME_RESOLU,
    StatutPoint.FERME_RISQUE_ACCEPTE,
    StatutPoint.OUVERT, // rejet CPF par l'auditeur
  ],
  [StatutPoint.FERME_RESOLU]: [StatutPoint.OUVERT], // réouverture par Manager uniquement (contrôlé côté controller)
  [StatutPoint.FERME_RISQUE_ACCEPTE]: [StatutPoint.OUVERT],
  [StatutPoint.OBSOLETE]: [],
};

// Libellés lisibles pour les statuts de point d'audit
const STATUT_POINT_LABELS: Partial<Record<string, string>> = {
  OUVERT: 'Ouvert',
  EN_ATTENTE_VALIDATION: 'En attente de validation',
  VALIDE: 'Validé',
  FERME_RESOLU: 'Fermé — Résolu',
  FERME_RISQUE_ACCEPTE: 'Fermé — Risque accepté',
};

@Injectable()
export class PointsAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  // CRÉATION
  // ═══════════════════════════════════════════════════════════════════════

  async create(createurId: string, dto: CreatePointAuditDto, user?: UserContext) {
    const audit = await this.prisma.audit.findUnique({ where: { id: dto.auditId } });
    if (!audit) throw new NotFoundException("Mission d'audit introuvable.");

    // BUG-BL-005 : Bloquer la création sur une mission PLANIFIE
    if (audit.statut === StatutAudit.PLANIFIE) {
      throw new BadRequestException(
        "Impossible d'ajouter un constat sur une mission au statut PLANIFIE. " +
        "Démarrez la mission (EN_COURS) avant d'y enregistrer des constats.",
      );
    }

    // BUG-DATA-003 : Référence unique par mission (F-XXX dans le contexte de la mission)
    const count = await this.prisma.pointAudit.count({ where: { auditId: dto.auditId } });
    const reference = `F-${(count + 1).toString().padStart(3, '0')}`;

    const point = await this.prisma.pointAudit.create({
      data: {
        ...dto,
        reference,
        createurId,
        dateEcheanceInitiale: new Date(dto.dateEcheanceInitiale),
        dateEcheanceActuelle: new Date(dto.dateEcheanceInitiale),
      },
      include: {
        departement: { select: { nom: true, code: true } },
        createur: { select: { nom: true, prenom: true } },
      },
    });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action: TypeActionLog.CREATION,
        entiteType: 'POINT_AUDIT',
        entiteId: point.id,
        entiteRef: point.reference,
      });
    }

    return point;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LISTE PAGINÉE
  // ═══════════════════════════════════════════════════════════════════════

  async findAll(query: PointQueryDto): Promise<PaginationResponseDto<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      criticite,
      statut,
      statutBu,
      auditId,
      departementId,
      createurId,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { titre: { contains: search, mode: 'insensitive' } },
                { reference: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        criticite ? { criticite } : {},
        statut ? { statut } : {},
        statutBu ? { statutBu } : {},
        auditId ? { auditId } : {},
        departementId ? { departementId } : {},
        createurId ? { createurId } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.pointAudit.count({ where }),
      this.prisma.pointAudit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          audit: { select: { reference: true, titre: true } },
          departement: { select: { code: true } },
          createur: { select: { nom: true, prenom: true, role: true } },
          _count: { select: { actions: true } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DÉTAIL
  // ═══════════════════════════════════════════════════════════════════════

  async findOne(id: string) {
    const point = await this.prisma.pointAudit.findUnique({
      where: { id },
      include: {
        audit: true,
        departement: true,
        createur: { select: { nom: true, prenom: true, role: true } },
        actions: {
          include: { responsable: { select: { nom: true, prenom: true } } },
          orderBy: { createdAt: 'desc' },
        },
        commentaires: { orderBy: { dateCreation: 'desc' } },
        historique: { orderBy: { dateModification: 'desc' } },
      },
    });
    if (!point) throw new NotFoundException("Point d'audit introuvable.");
    return point;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MISE À JOUR GÉNÉRALE (Audit team only)
  // ═══════════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdatePointsAuditDto, user?: UserContext) {
    const existing = await this.prisma.pointAudit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Point d'audit introuvable.");

    // Préparer les données de mise à jour
    const data: any = { ...dto };

    // Convertir les dates si présentes
    if (dto.dateEcheanceActuelle) {
      data.dateEcheanceActuelle = new Date(dto.dateEcheanceActuelle);
    }
    if (dto.revueLe) {
      data.revueLe = new Date(dto.revueLe);
    }

    // Si le statut officiel change, enregistrer l'historique
    if (dto.statut && dto.statut !== existing.statut) {
      await this._enregistrerHistoriqueStatut(id, 'statut', existing.statut, dto.statut, user);

      // Auto-dates selon le statut
      if (dto.statut === StatutPoint.EN_ATTENTE_VALIDATION && !existing.dateCPF) {
        data.dateCPF = new Date();
      }
      if (
        (dto.statut === StatutPoint.FERME_RESOLU || dto.statut === StatutPoint.FERME_RISQUE_ACCEPTE) &&
        !existing.dateResolution
      ) {
        data.dateResolution = new Date();
      }
    }

    const point = await this.prisma.pointAudit.update({
      where: { id },
      data,
    });

    if (user) {
      const action = dto.statut ? TypeActionLog.VALIDATION_POINT : TypeActionLog.MODIFICATION;
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action,
        entiteType: 'POINT_AUDIT',
        entiteId: point.id,
        entiteRef: point.reference,
        details: dto.statut ? { statut: dto.statut } : undefined,
      });
    }

    return point;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHANGEMENT DE STATUT BU (Risk Champion / Action Owner)
  // ═══════════════════════════════════════════════════════════════════════

  async changerStatutBU(
    id: string,
    statutBu: StatutPoint,
    commentaireStatutBu: string,
    user: UserContext,
  ) {
    // Vérifier que l'utilisateur est bien BU
    if (!ROLES_BU.includes(user.role)) {
      throw new ForbiddenException('Seuls les membres de la BU peuvent déclarer ce statut.');
    }

    // Vérifier que le statut est autorisé pour la BU
    if (!STATUTS_AUTORISES_BU.includes(statutBu)) {
      throw new BadRequestException(
        `La BU ne peut déclarer que les statuts : ${STATUTS_AUTORISES_BU.join(', ')}.`,
      );
    }

    // Commentaire obligatoire (min 5 caractères)
    if (!commentaireStatutBu || commentaireStatutBu.trim().length < 5) {
      throw new BadRequestException(
        'Un commentaire justificatif (min. 5 caractères) est obligatoire lors du changement de statut.',
      );
    }

    const existing = await this.prisma.pointAudit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Point d'audit introuvable.");

    // Vérifier que le point appartient au département de l'utilisateur BU (RISK_CHAMPION, EMPLOYE_METIER)
    // MANAGER_METIER a accès à tous les points de son département
    if (user.departementId && user.role !== RoleUtilisateur.ADMIN) {
      if (existing.departementId !== user.departementId) {
        throw new ForbiddenException(
          "Vous ne pouvez déclarer le statut BU que pour les points de votre département.",
        );
      }
    }

    const existingAny = existing as any;

    // Enregistrer l'historique si le statutBu change
    if (statutBu !== existingAny.statutBu) {
      await this._enregistrerHistoriqueStatut(id, 'statutBu', existingAny.statutBu as StatutPoint | null, statutBu, user);
    }

    // Construire le payload en tant que any (champs ajoutés par migration, client pas encore régénéré)
    const buUpdateData: any = {
      statutBu,
      commentaireStatutBu: commentaireStatutBu.trim(),
    };
    if (statutBu === StatutPoint.EN_ATTENTE_VALIDATION && !existing.dateCPF) {
      buUpdateData.dateCPF = new Date();
    }

    const point = await this.prisma.pointAudit.update({
      where: { id },
      data: buUpdateData,
    });

    await this.journalService.logAction({
      utilisateurId: user.id,
      utilisateurNom: user.nom,
      utilisateurRole: user.role,
      action: TypeActionLog.VALIDATION_POINT,
      entiteType: 'POINT_AUDIT',
      entiteId: point.id,
      entiteRef: point.reference,
      details: { statutBu, commentaireStatutBu: commentaireStatutBu.trim() },
    });

    return point;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CHANGEMENT DE STATUT OFFICIEL AUDIT
  // ═══════════════════════════════════════════════════════════════════════

  async changerStatutAudit(
    id: string,
    statut: StatutPoint,
    user: UserContext,
    revidePar?: string,
    formulaireRisqueId?: string,
  ) {
    // Vérifier que l'utilisateur est bien de l'équipe Audit
    if (!ROLES_AUDIT.includes(user.role)) {
      throw new ForbiddenException("Seule l'équipe Audit peut modifier le statut officiel.");
    }

    const existing = await this.prisma.pointAudit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Point d'audit introuvable.");

    // ── Machine d'état : valider la transition ─────────────────────────────
    const transitionsAutorisees = TRANSITIONS_AUTORISEES[existing.statut] ?? [];
    if (statut !== existing.statut && !transitionsAutorisees.includes(statut)) {
      throw new BadRequestException(
        `Transition non autorisée : ${existing.statut} → ${statut}. ` +
        `Transitions possibles : ${transitionsAutorisees.join(', ') || 'aucune'}.`,
      );
    }

    // ── BUG-BL-008 : Clôture réservée aux managers audit ──────────────────
    const ROLES_CLOTURE: string[] = [
      RoleUtilisateur.ADMIN,
      RoleUtilisateur.DIRECTEUR_AUDIT,
      RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
      RoleUtilisateur.CHEF_MISSION,
      RoleUtilisateur.AUDITEUR_SENIOR,
    ];
    const EST_CLOTURE = statut === StatutPoint.FERME_RESOLU || statut === StatutPoint.FERME_RISQUE_ACCEPTE;
    if (EST_CLOTURE && !ROLES_CLOTURE.includes(user.role)) {
      throw new ForbiddenException(
        "Seuls les auditeurs seniors et supérieurs peuvent clore un point d'audit.",
      );
    }

    // ── Validation : FERME_RISQUE_ACCEPTE nécessite un RAF validé ──────────
    if (statut === StatutPoint.FERME_RISQUE_ACCEPTE) {
      const rafId = formulaireRisqueId ?? (existing as any).formulaireRisqueId;
      if (!rafId) {
        throw new BadRequestException(
          "Un formulaire RAF validé (formulaireRisqueId) est obligatoire pour clore un point en 'Risque Accepté'.",
        );
      }
      const raf = await this.prisma.formulaireAcceptationRisque.findUnique({ where: { id: rafId } });
      if (!raf) {
        throw new BadRequestException('Formulaire RAF introuvable.');
      }
      // Vérifier que le RAF est entièrement validé (Comité Audit)
      if (!raf.validePar_ComiteAudit) {
        throw new BadRequestException(
          "Le formulaire RAF doit être validé par le Comité d'Audit avant de pouvoir clore le point en 'Risque Accepté'.",
        );
      }
    }

    const data: any = { statut };

    // ── Auto-dates selon le nouveau statut ─────────────────────────────────
    if (statut === StatutPoint.EN_ATTENTE_VALIDATION && !existing.dateCPF) {
      data.dateCPF = new Date();
    }
    if (statut === StatutPoint.FERME_RESOLU || statut === StatutPoint.FERME_RISQUE_ACCEPTE) {
      data.dateResolution = new Date();
    }

    // ── Réinitialisation lors de la réouverture ────────────────────────────
    if (statut === StatutPoint.OUVERT && existing.statut !== StatutPoint.OUVERT) {
      data.dateResolution = null;
      data.revidePar = null;
      data.revueLe = null;
      // Si on rejette un CPF, remettre le statutBu à OUVERT et effacer le commentaire
      if ((existing as any).statutBu === StatutPoint.EN_ATTENTE_VALIDATION) {
        data.statutBu = StatutPoint.OUVERT;
        data.commentaireStatutBu = null;
        data.dateCPF = null;
      }
    }

    // ── Lier le formulaire RAF ─────────────────────────────────────────────
    if (statut === StatutPoint.FERME_RISQUE_ACCEPTE && formulaireRisqueId) {
      data.formulaireRisqueId = formulaireRisqueId;
    }

    // ── Revue de clôture (Manager Audit) ───────────────────────────────────
    const ROLES_MANAGER: string[] = [
      RoleUtilisateur.CHEF_MISSION,
      RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
      RoleUtilisateur.DIRECTEUR_AUDIT,
      RoleUtilisateur.ADMIN,
    ];
    if (
      (statut === StatutPoint.FERME_RESOLU || statut === StatutPoint.FERME_RISQUE_ACCEPTE) &&
      ROLES_MANAGER.includes(user.role)
    ) {
      data.revidePar = revidePar ?? user.nom;
      data.revueLe = new Date();
    }

    // Enregistrer l'historique si le statut change
    if (statut !== existing.statut) {
      await this._enregistrerHistoriqueStatut(id, 'statut', existing.statut, statut, user);
    }

    const point = await this.prisma.pointAudit.update({ where: { id }, data: data as any });

    await this.journalService.logAction({
      utilisateurId: user.id,
      utilisateurNom: user.nom,
      utilisateurRole: user.role,
      action: TypeActionLog.VALIDATION_POINT,
      entiteType: 'POINT_AUDIT',
      entiteId: point.id,
      entiteRef: point.reference,
      details: { statut },
    });

    // ── Notification in-app au créateur du point (si différent de l'acteur) ──
    if (point.createurId && point.createurId !== user.id) {
      const createur = await this.prisma.utilisateur.findUnique({
        where: { id: point.createurId },
        select: { id: true, email: true },
      });
      if (createur) {
        await this.notificationsService.creer({
          destinataire: createur.email,
          sujet: `Mise à jour du constat ${point.reference}`,
          message: `Le statut du constat "${point.titre}" (${point.reference}) a été mis à jour en "${STATUT_POINT_LABELS[statut] ?? statut}" par ${user.nom}.`,
          type: 'CHANGEMENT_STATUT',
          utilisateurId: createur.id,
          entiteType: 'POINT_AUDIT',
          entiteId: point.id,
        });
      }
    }

    return point;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SUPPRESSION
  // ═══════════════════════════════════════════════════════════════════════

  async remove(id: string, user?: UserContext) {
    const point = await this.prisma.pointAudit.findUnique({
      where: { id },
      select: { reference: true },
    });
    if (!point) throw new NotFoundException("Point d'audit introuvable.");

    const result = await this.prisma.pointAudit.delete({ where: { id } });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action: TypeActionLog.SUPPRESSION,
        entiteType: 'POINT_AUDIT',
        entiteId: id,
        entiteRef: point.reference,
      });
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IMPORT BATCH EXCEL
  // ═══════════════════════════════════════════════════════════════════════

  async createMany(createurId: string, dtos: CreatePointAuditDto[], user?: UserContext) {
    const results = await this.prisma.$transaction(async (tx) => {
      const items: PointAudit[] = [];
      const baseCount = await tx.pointAudit.count();

      for (let i = 0; i < dtos.length; i++) {
        const reference = `F-${(baseCount + i + 1).toString().padStart(3, '0')}`;
        const point = await tx.pointAudit.create({
          data: {
            ...dtos[i],
            reference,
            createurId,
            dateEcheanceInitiale: new Date(dtos[i].dateEcheanceInitiale),
            dateEcheanceActuelle: new Date(dtos[i].dateEcheanceInitiale),
          },
        });
        items.push(point);
      }
      return items;
    });

    if (user && results.length > 0) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action: TypeActionLog.IMPORT_EXCEL,
        entiteType: 'POINT_AUDIT',
        details: { count: results.length },
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MÉTHODES PRIVÉES
  // ═══════════════════════════════════════════════════════════════════════

  private async _enregistrerHistoriqueStatut(
    pointAuditId: string,
    champ: string,
    ancienStatut: StatutPoint | null,
    nouveauStatut: StatutPoint,
    user?: UserContext,
  ) {
    try {
      await this.prisma.historiqueStatut.create({
        data: {
          typeEntite: 'POINT_AUDIT',
          entiteId: pointAuditId,
          pointAuditId,
          statutPrecedent: ancienStatut ? `${champ}:${ancienStatut}` : undefined,
          nouveauStatut: `${champ}:${nouveauStatut}`,
          modifiePar: user ? `${user.nom} (${user.role})` : 'Système',
        },
      });
    } catch {
      // Ignore silencieusement si le modèle n'est pas encore accessible
    }
  }
}
