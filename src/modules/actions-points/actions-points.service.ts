import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateActionPointDto } from './dto/create-actions-point.dto';
import { UpdateActionPointDto } from './dto/update-actions-point.dto';
import { RoleUtilisateur, TypeActionLog } from 'src/generated/prisma/enums';
import {
  isPrivilegedRole,
  isBURole,
  isAuditTeamRole,
  ROLES_AUDIT_SENIOR_PLUS,
} from 'src/auth/constants/roles-matrix';
import { JournalAuditService } from '../journal-audit/journal-audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppGateway } from 'src/socket-io/gateways/app.gateway';
import { SOCKET_EVENTS } from 'src/socket-io/interfaces/connected-user.interface';

export interface UserContext {
  id: string;
  nom: string;
  role: RoleUtilisateur | string;
  departementId?: string | null;
}

@Injectable()
export class ActionsPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
    private readonly notificationsService: NotificationsService,
    private readonly gateway: AppGateway,
  ) {}

  async create(dto: CreateActionPointDto, user?: UserContext) {
    const point = await this.prisma.pointAudit.findUnique({
      where: { id: dto.pointAuditId },
    });
    if (!point) throw new NotFoundException("Point d'audit introuvable.");

    const action = await this.prisma.actionPoint.create({
      data: {
        ...dto,
        statut: 'A_FAIRE',
        dateEcheance: new Date(dto.dateEcheance),
        avancement: 0,
      },
      include: {
        responsable: { select: { nom: true, prenom: true, email: true } },
      },
    });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role as string,
        action: TypeActionLog.CREATION,
        entiteType: 'ACTION_POINT',
        entiteId: action.id,
        entiteRef: action.description?.slice(0, 80) ?? action.id,
      });
    }

    // 🔌 Temps réel — équipe audit + responsable
    const createPayload = {
      id: action.id,
      pointAuditId: action.pointAuditId,
      responsableId: action.responsableId,
      description: action.description?.slice(0, 120),
      dateEcheance: action.dateEcheance,
      statut: action.statut,
    };
    this.gateway.emitToAuditTeam(SOCKET_EVENTS.ACTION_CREATED, createPayload);
    this.gateway.emitToUser(action.responsableId, SOCKET_EVENTS.ACTION_CREATED, createPayload);

    // Notifier le responsable assigné de cette action
    try {
      if (action.responsable?.email) {
        await this.notificationsService.creer({
          destinataire: action.responsable.email,
          utilisateurId: action.responsableId,
          sujet: `[ACTION ASSIGNÉE] ${action.description?.slice(0, 60)}`,
          message: `Une action corrective vous a été assignée. Échéance : ${new Date(
            action.dateEcheance,
          ).toLocaleDateString('fr-FR')}.`,
          type: 'ACTION_ASSIGNEE',
          entiteType: 'ACTION_POINT',
          entiteId: action.id,
        });
      }
    } catch (err) {
      console.error('[actions-points] Échec notif assignation action:', err);
    }

    return action;
  }

  async findAll(query: any, user?: UserContext): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 10, pointAuditId, responsableId, statut } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // ---- FILTRAGE PAR SCOPE ----
    const scopeFilters: any[] = [];
    if (user && !isPrivilegedRole(user.role as RoleUtilisateur)) {
      if (isBURole(user.role as RoleUtilisateur)) {
        // BU : voit ses propres actions (responsableId) OU celles du même département
        scopeFilters.push({
          OR: [
            { responsableId: user.id },
            {
              pointAudit: {
                departementId: user.departementId ?? '__no_dept__',
              },
            },
          ],
        });
      } else if (isAuditTeamRole(user.role as RoleUtilisateur)) {
        // Audit team : actions sur points qu'ils ont créés ou audits où ils sont équipe/responsable
        scopeFilters.push({
          pointAudit: {
            OR: [
              { createurId: user.id },
              { audit: { responsableId: user.id } },
              { audit: { equipe: { some: { id: user.id } } } },
            ],
          },
        });
      }
    }

    const where: any = {
      AND: [
        pointAuditId ? { pointAuditId } : {},
        responsableId ? { responsableId } : {},
        statut ? { statut } : {},
        ...scopeFilters,
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.actionPoint.count({ where }),
      this.prisma.actionPoint.findMany({
        where,
        skip: skip,
        take: Number(limit),
        orderBy: { dateEcheance: 'asc' },
        include: {
          responsable: { select: { id: true, nom: true, prenom: true } },
          pointAudit: {
            select: {
              id: true,
              reference: true,
              titre: true,
              departementId: true,
            },
          },
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

  async update(id: string, dto: UpdateActionPointDto, user?: UserContext) {
    // Charger l'action existante pour vérification ownership
    const existing = await this.prisma.actionPoint.findUnique({
      where: { id },
      include: {
        pointAudit: {
          select: {
            departementId: true,
            audit: {
              select: { responsableId: true, equipe: { select: { id: true } } },
            },
          },
        },
      },
    });
    if (!existing) throw new NotFoundException('Action introuvable.');

    // ---- VÉRIFICATION OWNERSHIP ----
    if (user && !isPrivilegedRole(user.role as RoleUtilisateur)) {
      const isOwner = existing.responsableId === user.id;
      const isAuditMember =
        existing.pointAudit?.audit?.responsableId === user.id ||
        existing.pointAudit?.audit?.equipe?.some((m) => m.id === user.id);

      // Audit Senior+ peuvent modifier n'importe quelle action de leur mission
      const isSeniorAudit = ROLES_AUDIT_SENIOR_PLUS.includes(
        user.role as RoleUtilisateur,
      );

      if (isBURole(user.role as RoleUtilisateur)) {
        // BU : doit être responsable de l'action OU manager du département
        const isSameDept =
          existing.pointAudit?.departementId === user.departementId;
        const isManager = user.role === RoleUtilisateur.MANAGER_METIER;
        if (!isOwner && !(isManager && isSameDept)) {
          throw new ForbiddenException(
            "Vous ne pouvez modifier que les actions dont vous êtes responsable",
          );
        }
      } else if (isAuditTeamRole(user.role as RoleUtilisateur) && !isSeniorAudit) {
        // Auditeur junior : doit être membre de l'audit
        if (!isAuditMember) {
          throw new ForbiddenException(
            "Vous n'êtes pas membre de la mission liée à cette action",
          );
        }
      }
    }

    // Logique métier : statut auto selon l'avancement
    if (dto.avancement === 100) {
      dto.statut = 'TERMINE';
    } else if (dto.avancement && dto.avancement > 0 && dto.avancement < 100) {
      dto.statut = 'EN_COURS';
    }

    const updated = await this.prisma.actionPoint.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dateEcheance && { dateEcheance: new Date(dto.dateEcheance) }),
      },
    });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role as string,
        action: TypeActionLog.MODIFICATION,
        entiteType: 'ACTION_POINT',
        entiteId: id,
        entiteRef: updated.description?.slice(0, 80) ?? updated.id,
        details: { champs: Object.keys(dto) },
      });
    }

    // 🔌 Temps réel
    const updatePayload = {
      id: updated.id,
      pointAuditId: updated.pointAuditId,
      responsableId: updated.responsableId,
      avancement: updated.avancement,
      statut: updated.statut,
      changes: Object.keys(dto),
    };
    this.gateway.emitToAuditTeam(SOCKET_EVENTS.ACTION_UPDATED, updatePayload);
    this.gateway.emitToUser(updated.responsableId, SOCKET_EVENTS.ACTION_UPDATED, updatePayload);

    return updated;
  }

  async remove(id: string, user?: UserContext) {
    const existing = await this.prisma.actionPoint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Action introuvable.');
    const result = await this.prisma.actionPoint.delete({ where: { id } });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role as string,
        action: TypeActionLog.SUPPRESSION,
        entiteType: 'ACTION_POINT',
        entiteId: id,
        entiteRef: existing.description?.slice(0, 80) ?? existing.id,
      });
    }

    // 🔌 Temps réel
    this.gateway.emitToAuditTeam(SOCKET_EVENTS.ACTION_DELETED, {
      id,
      pointAuditId: existing.pointAuditId,
    });

    return result;
  }
}
