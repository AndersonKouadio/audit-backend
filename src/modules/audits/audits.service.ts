import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { JournalAuditService } from '../journal-audit/journal-audit.service';
import { TypeActionLog, RoleUtilisateur } from 'src/generated/prisma/enums';
import {
  isPrivilegedRole,
  isBURole,
  isAuditTeamRole,
} from 'src/auth/constants/roles-matrix';

export interface UserContext {
  id: string;
  nom: string;
  role: RoleUtilisateur | string;
  departementId?: string | null;
}

@Injectable()
export class AuditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
  ) { }

  async create(dto: CreateAuditDto, user?: UserContext) {
    // 1. Vérifier si la référence est unique
    const exists = await this.prisma.audit.findUnique({
      where: { reference: dto.reference },
    });
    if (exists)
      throw new ConflictException(
        `La référence ${dto.reference} est déjà utilisée.`,
      );

    // 2. Création avec relations
    const { equipeIds, ...data } = dto;

    const audit = await this.prisma.audit.create({
      data: {
        ...data,
        dateDebutPrevue: new Date(data.dateDebutPrevue),
        dateFinPrevue: new Date(data.dateFinPrevue),
        equipe: {
          connect: equipeIds?.map((id) => ({ id })) || [],
        },
      },
      include: {
        responsable: { select: { nom: true, prenom: true } },
        departement: { select: { nom: true, code: true } },
        equipe: { select: { nom: true, prenom: true } },
      },
    });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action: TypeActionLog.CREATION,
        entiteType: 'AUDIT',
        entiteId: audit.id,
        entiteRef: audit.reference,
      });
    }

    return audit;
  }

  async findAll(
    query: AuditQueryDto,
    user?: UserContext,
  ): Promise<PaginationResponseDto<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      statut,
      annee,
      departementId,
      actif,
    } = query;
    const skip = (page - 1) * limit;

    // ---- FILTRAGE PAR SCOPE (server-side) ----
    // Les rôles privilégiés (ADMIN, DIRECTEUR_AUDIT, CHEF_DEPT_AUDIT, LECTURE_SEULE)
    // voient tout. Les autres rôles ont un filtrage strict.
    const scopeFilters: any[] = [];

    if (user && !isPrivilegedRole(user.role as RoleUtilisateur)) {
      if (isBURole(user.role as RoleUtilisateur)) {
        // BU : ne voit que les audits de son département + statuts publiés (pas en cours)
        scopeFilters.push({
          departementId: user.departementId ?? '__no_dept__',
          statut: { in: ['PUBLIE', 'CLOTURE', 'ARCHIVE'] },
        });
      } else if (isAuditTeamRole(user.role as RoleUtilisateur)) {
        // Audit team (sauf privilégiés) : voit les audits où il est responsable ou dans l'équipe
        scopeFilters.push({
          OR: [
            { responsableId: user.id },
            { equipe: { some: { id: user.id } } },
          ],
        });
      }
    }

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
        type ? { type } : {},
        statut ? { statut } : {},
        annee ? { anneeFiscale: annee } : {},
        departementId ? { departementId } : {},
        actif ? { statut: { notIn: ['CLOTURE', 'ARCHIVE'] } } : {},
        ...scopeFilters,
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.audit.count({ where }),
      this.prisma.audit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateDebutPrevue: 'desc' },
        include: {
          departement: { select: { nom: true, code: true } },
          responsable: { select: { nom: true, prenom: true } },
          _count: { select: { points: true } }, // Nombre de findings par audit
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

  async findOne(id: string, user?: UserContext) {
    const audit = await this.prisma.audit.findUnique({
      where: { id },
      include: {
        departement: { select: { nom: true, code: true } },
        responsable: { select: { id: true, nom: true, prenom: true } },
        equipe: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { points: true } },
      },
    });

    if (!audit) throw new NotFoundException(`Audit ${id} introuvable`);

    // ---- VÉRIFICATION DE SCOPE ----
    if (user && !isPrivilegedRole(user.role as RoleUtilisateur)) {
      if (isBURole(user.role as RoleUtilisateur)) {
        const isVisibleStatut = ['PUBLIE', 'CLOTURE', 'ARCHIVE'].includes(audit.statut);
        const isSameDept = audit.departementId === user.departementId;
        if (!isVisibleStatut || !isSameDept) {
          throw new ForbiddenException(
            "Vous n'avez pas accès à cette mission d'audit",
          );
        }
      } else if (isAuditTeamRole(user.role as RoleUtilisateur)) {
        const isResponsable = audit.responsable?.id === user.id;
        const isInTeam = audit.equipe?.some((m) => m.id === user.id);
        if (!isResponsable && !isInTeam) {
          throw new ForbiddenException(
            "Vous n'êtes pas membre de cette mission d'audit",
          );
        }
      }
    }

    return audit;
  }

  async update(id: string, dto: UpdateAuditDto, user?: UserContext) {
    const { equipeIds, ...data } = dto;
    const audit = await this.prisma.audit.update({
      where: { id },
      data: {
        ...data,
        ...(data.dateDebutPrevue && { dateDebutPrevue: new Date(data.dateDebutPrevue) }),
        ...(data.dateFinPrevue && { dateFinPrevue: new Date(data.dateFinPrevue) }),
        ...(equipeIds && {
          equipe: {
            set: equipeIds.map((id) => ({ id })),
          },
        }),
      },
    });

    if (user) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action: TypeActionLog.MODIFICATION,
        entiteType: 'AUDIT',
        entiteId: audit.id,
        entiteRef: audit.reference,
        details: { champs: Object.keys(data) },
      });
    }

    return audit;
  }

  async remove(id: string, user?: UserContext) {
    const audit = await this.prisma.audit.findUnique({ where: { id }, select: { reference: true } });
    const result = await this.prisma.audit.delete({ where: { id } });

    if (user && audit) {
      await this.journalService.logAction({
        utilisateurId: user.id,
        utilisateurNom: user.nom,
        utilisateurRole: user.role,
        action: TypeActionLog.SUPPRESSION,
        entiteType: 'AUDIT',
        entiteId: id,
        entiteRef: audit.reference,
      });
    }

    return result;
  }
}
