import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePointAuditDto } from './dto/create-points-audit.dto';
import { PointQueryDto } from './dto/point-query.dto';

@Injectable()
export class PointsAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createurId: string, dto: CreatePointAuditDto) {
    // 1. Vérifier si l'audit existe
    const audit = await this.prisma.audit.findUnique({
      where: { id: dto.auditId },
    });
    if (!audit) throw new NotFoundException("Mission d'audit introuvable.");

    // 2. Générer une référence simple (ex: F-X)
    const count = await this.prisma.pointAudit.count();
    const reference = `F-${(count + 1).toString().padStart(3, '0')}`;

    // 3. Création
    return this.prisma.pointAudit.create({
      data: {
        ...dto,
        reference,
        createurId,
        dateEcheanceActuelle: dto.dateEcheanceInitiale, // Par défaut, identique à l'initiale
      },
      include: {
        departement: { select: { nom: true, code: true } },
        createur: { select: { nom: true, prenom: true } },
      },
    });
  }

  async findAll(query: PointQueryDto): Promise<PaginationResponseDto<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      criticite,
      statut,
      auditId,
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
        criticite ? { criticite } : {},
        statut ? { statut } : {},
        auditId ? { auditId } : {},
        departementId ? { departementId } : {},
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

  async findOne(id: string) {
    const point = await this.prisma.pointAudit.findUnique({
      where: { id },
      include: {
        audit: true,
        departement: true,
        actions: {
          include: { responsable: { select: { nom: true, prenom: true } } },
        },
        commentaires: true,
        historique: true,
      },
    });
    if (!point) throw new NotFoundException("Point d'audit introuvable.");
    return point;
  }
}
