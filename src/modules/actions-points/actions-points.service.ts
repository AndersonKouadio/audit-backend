import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateActionPointDto } from './dto/create-actions-point.dto';
import { UpdateActionPointDto } from './dto/update-actions-point.dto';

@Injectable()
export class ActionsPointsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateActionPointDto) {
    const point = await this.prisma.pointAudit.findUnique({
      where: { id: dto.pointAuditId },
    });
    if (!point) throw new NotFoundException("Point d'audit introuvable.");

    return this.prisma.actionPoint.create({
      data: {
        ...dto,
        statut: 'A_FAIRE',
        avancement: 0,
      },
      include: {
        responsable: { select: { nom: true, prenom: true, email: true } },
      },
    });
  }

  async findAll(query: any): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 10, pointAuditId, responsableId, statut } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        pointAuditId ? { pointAuditId } : {},
        responsableId ? { responsableId } : {},
        statut ? { statut } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.actionPoint.count({ where }),
      this.prisma.actionPoint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateEcheance: 'asc' },
        include: {
          responsable: { select: { nom: true, prenom: true } },
          pointAudit: { select: { reference: true, titre: true } },
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

  async update(id: string, dto: UpdateActionPointDto) {
    // Logique métier : Si l'avancement est mis à 100, on passe auto en TERMINE
    if (dto.avancement === 100) {
      dto.statut = 'TERMINE';
    } else if (dto.avancement && dto.avancement > 0 && dto.avancement < 100) {
      dto.statut = 'EN_COURS';
    }

    return this.prisma.actionPoint.update({
      where: { id },
      data: dto,
    });
  }
}
