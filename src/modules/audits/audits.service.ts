import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';
import { JournalAuditService } from '../journal-audit/journal-audit.service';
import { TypeActionLog } from 'src/generated/prisma/enums';

export interface UserContext {
  id: string;
  nom: string;
  role: string;
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

  async findAll(query: AuditQueryDto): Promise<PaginationResponseDto<any>> {
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

  findOne(id: string) {
    return this.prisma.audit.findUnique({
      where: { id }, include: {
        departement: { select: { nom: true, code: true } },
        responsable: { select: { nom: true, prenom: true } },
        _count: { select: { points: true } }, // Nombre de findings par audit
      },
    });
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
