import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePointFraudeDto } from './dto/create-point-fraude.dto';
import { PointFraudeQueryDto } from './dto/point-fraude-query.dto';
import { UpdatePointFraudeDto } from './dto/update-point-fraude.dto';

@Injectable()
export class PointsFraudeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePointFraudeDto) {
    // Vérifier unicité du code
    const existant = await this.prisma.pointFraude.findUnique({
      where: { code: dto.code },
    });
    if (existant) {
      throw new ConflictException(`Le code ${dto.code} est déjà utilisé.`);
    }

    // Vérifier que le cas parent existe
    const cas = await this.prisma.casFraude.findUnique({ where: { id: dto.casId } });
    if (!cas) throw new NotFoundException('Cas de fraude introuvable.');

    return this.prisma.pointFraude.create({
      data: {
        ...dto,
        dateEcheance: new Date(dto.dateEcheance),
        ...(dto.dateReporting && { dateReporting: new Date(dto.dateReporting) }),
      },
      include: {
        auditeurFRM: { select: { nom: true, prenom: true } },
        cas: { select: { numeroCas: true, titre: true } },
      },
    });
  }

  async findAll(query: PointFraudeQueryDto): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 10, search, statut, casId, auditeurFRMId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { titre: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        statut ? { statut } : {},
        casId ? { casId } : {},
        auditeurFRMId ? { auditeurFRMId } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.pointFraude.count({ where }),
      this.prisma.pointFraude.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cas: { select: { numeroCas: true, titre: true } },
          auditeurFRM: { select: { nom: true, prenom: true } },
        },
      }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const point = await this.prisma.pointFraude.findUnique({
      where: { id },
      include: {
        cas: true,
        auditeurFRM: { select: { nom: true, prenom: true, email: true } },
        historique: { orderBy: { dateModification: 'desc' } },
        commentaires: { orderBy: { dateCreation: 'desc' } },
        piecesJointes: true,
      },
    });
    if (!point) throw new NotFoundException('Point de fraude introuvable.');
    return point;
  }

  async update(id: string, dto: UpdatePointFraudeDto) {
    const pointExistant = await this.findOne(id);
    const { commentaire, dateEcheance, dateReporting, ...reste } = dto as any;

    // Si changement de statut → créer un historique
    if (dto.statut && dto.statut !== pointExistant.statut) {
      await this.prisma.historiqueStatut.create({
        data: {
          typeEntite: 'POINT_FRAUDE',
          entiteId: id,
          statutPrecedent: pointExistant.statut,
          nouveauStatut: dto.statut,
          commentaire: commentaire || null,
          modifiePar: 'système',
          pointFraudeId: id,
        },
      });
    }

    return this.prisma.pointFraude.update({
      where: { id },
      data: {
        ...reste,
        ...(dateEcheance && { dateEcheance: new Date(dateEcheance) }),
        ...(dateReporting && { dateReporting: new Date(dateReporting) }),
      },
    });
  }
}
