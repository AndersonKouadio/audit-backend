import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePointAuditDto } from './dto/create-points-audit.dto';
import { PointQueryDto } from './dto/point-query.dto';
import { UpdatePointsAuditDto } from './dto/update-points-audit.dto';
import { PointAudit } from 'src/generated/prisma/client';

@Injectable()
export class PointsAuditService {
  constructor(private readonly prisma: PrismaService) { }

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
        dateEcheanceInitiale: new Date(dto.dateEcheanceInitiale),
        dateEcheanceActuelle: new Date(dto.dateEcheanceInitiale), // Par défaut, identique à l'initiale
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
  // Méthode pour la mise à jour (Statut, Criticité, etc.)
  async update(id: string, dto: UpdatePointsAuditDto) {
    return this.prisma.pointAudit.update({
      where: { id },
      data: dto,
    });
  }

  // Logique pour l'import groupé (Staging)
  async createMany(createurId: string, dtos: CreatePointAuditDto[]) {
    // On utilise une transaction pour garantir que tout passe ou rien
    return this.prisma.$transaction(async (tx) => {
      const results : PointAudit[] = [];
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
          }
        });
        results.push(point);
      }
      return results;
    });
  }
}
