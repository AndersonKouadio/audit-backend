import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CasFraudeQueryDto } from './dto/cas-fraude-query.dto';
import { CreateCasFraudeDto } from './dto/create-cas-fraude.dto';
import { UpdateCasFraudeDto } from './dto/update-cas-fraude.dto';

@Injectable()
export class CasFraudeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCasFraudeDto) {
    // Vérifier l'unicité du numéro de cas
    const existant = await this.prisma.casFraude.findUnique({
      where: { numeroCas: dto.numeroCas },
    });
    if (existant) {
      throw new ConflictException(`Le numéro de cas ${dto.numeroCas} est déjà utilisé.`);
    }

    return this.prisma.casFraude.create({
      data: {
        ...dto,
        dateSignalement: new Date(dto.dateSignalement),
      },
      include: {
        departement: { select: { nom: true, code: true } },
        auditeurFRM: { select: { nom: true, prenom: true } },
      },
    });
  }

  async findAll(query: CasFraudeQueryDto): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 10, search, statut, departementId, auditeurFRMId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { titre: { contains: search, mode: 'insensitive' } },
                { numeroCas: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        statut ? { statut } : {},
        departementId ? { departementId } : {},
        auditeurFRMId ? { auditeurFRMId } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.casFraude.count({ where }),
      this.prisma.casFraude.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateSignalement: 'desc' },
        include: {
          departement: { select: { nom: true, code: true } },
          auditeurFRM: { select: { nom: true, prenom: true } },
          _count: { select: { points: true } },
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
    const cas = await this.prisma.casFraude.findUnique({
      where: { id },
      include: {
        departement: true,
        auditeurFRM: { select: { nom: true, prenom: true, email: true } },
        points: {
          include: {
            auditeurFRM: { select: { nom: true, prenom: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!cas) throw new NotFoundException('Cas de fraude introuvable.');
    return cas;
  }

  async update(id: string, dto: UpdateCasFraudeDto) {
    await this.findOne(id); // Vérification existence

    const { dateSignalement, ...reste } = dto as any;
    return this.prisma.casFraude.update({
      where: { id },
      data: {
        ...reste,
        ...(dateSignalement && { dateSignalement: new Date(dateSignalement) }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.casFraude.delete({ where: { id } });
  }
}
