import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDepartementDto } from './dto/create-departement.dto';
import { UpdateDepartementDto } from './dto/update-departement.dto';
import { Departement } from 'src/generated/prisma/client';
import { DeptQueryDto } from './dto/dept-query.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';

@Injectable()
export class DepartementsService {
  constructor(private readonly prisma: PrismaService) {}

  // CRÉATION
  async create(dto: CreateDepartementDto) {
    const exists = await this.prisma.departement.findUnique({
      where: { code: dto.code },
    });
    if (exists)
      throw new ConflictException(`Le code ${dto.code} est déjà utilisé.`);

    if (dto.parentId) {
      const parent = await this.prisma.departement.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent)
        throw new NotFoundException('Département parent introuvable.');
    }

    return this.prisma.departement.create({ data: dto });
  }
  // --- LISTE PAGINÉE ET FILTRÉE ---
  async findAllPaginated(
    query: DeptQueryDto,
  ): Promise<PaginationResponseDto<Departement>> {
    const { page = 1, limit = 10, search, parentId } = query;
    const skip = (page - 1) * limit;

    // Construction du filtre
    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { nom: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        parentId ? { parentId } : {},
      ],
    };

    // Exécution parallèle pour la performance
    const [total, data] = await Promise.all([
      this.prisma.departement.count({ where }),
      this.prisma.departement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nom: 'asc' },
        include: {
          parent: { select: { nom: true, code: true } },
          _count: { select: { employes: true, sousDepartements: true } },
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

  // L'ARBORESCENCE (Tree View)
  async findAllTree() {
    // 1. On récupère tout à plat avec le Risk Champion
    const allDepts = await this.prisma.departement.findMany({
      orderBy: { nom: 'asc' },
      include: {
        riskChampion: {
          select: { id: true, prenom: true, nom: true, email: true },
        },
      },
    });

    // 2. Fonction récursive pour construire l'arbre
    const buildTree = (
      items: Departement[],
      parentId: string | null = null,
    ): any[] => {
      return items
        .filter((item) => item.parentId === parentId)
        .map((item) => ({
          ...item,
          sousDepartements: buildTree(items, item.id),
        }));
    };

    return buildTree(allDepts, null);
  }

  async findOne(id: string) {
    const dept = await this.prisma.departement.findUnique({
      where: { id },
      include: {
        parent: true,
        sousDepartements: true,
        riskChampion: true,
      },
    });
    if (!dept) throw new NotFoundException(`Département #${id} introuvable`);
    return dept;
  }

  async update(id: string, dto: UpdateDepartementDto) {
    return this.prisma.departement.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    // Attention : On ne peut pas supprimer s'il y a des enfants ou des utilisateurs
    // Prisma gère ça via les contraintes, mais un try/catch propre serait mieux ici
    return this.prisma.departement.delete({ where: { id } });
  }
}
