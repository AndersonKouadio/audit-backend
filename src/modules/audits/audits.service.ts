import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { UpdateAuditDto } from './dto/update-audit.dto';

@Injectable()
export class AuditsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateAuditDto) {
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

    return this.prisma.audit.create({
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

  async update(id: string, dto: UpdateAuditDto) {
    const { equipeIds, ...data } = dto;
    return this.prisma.audit.update({
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
  }

  async remove(id: string) {
    return this.prisma.audit.delete({ where: { id } });
  }
}
