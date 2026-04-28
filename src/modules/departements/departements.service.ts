import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDepartementDto } from './dto/create-departement.dto';
import { UpdateDepartementDto } from './dto/update-departement.dto';
import { Departement } from 'src/generated/prisma/client';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { DeptQueryDto } from './dto/dept-query.dto';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { JournalAuditService } from '../journal-audit/journal-audit.service';

export interface UserContext {
  id: string;
  nom: string;
  role: string;
}

@Injectable()
export class DepartementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalService: JournalAuditService,
  ) {}

  // CRÉATION
  async create(dto: CreateDepartementDto, actor?: UserContext) {
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

    if (dto.riskChampionId) {
      const champion = await this.prisma.utilisateur.findUnique({
        where: { id: dto.riskChampionId },
      });
      if (!champion)
        throw new NotFoundException('Risk Champion (utilisateur) introuvable.');
    }

    const dept = await this.prisma.departement.create({ data: dto });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role,
        action: TypeActionLog.CREATION,
        entiteType: 'DEPARTEMENT',
        entiteId: dept.id,
        entiteRef: `${dept.code} - ${dept.nom}`,
      });
    }

    return dept;
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

  async update(id: string, dto: UpdateDepartementDto, actor?: UserContext) {
    if (dto.riskChampionId) {
      const champion = await this.prisma.utilisateur.findUnique({
        where: { id: dto.riskChampionId },
      });
      if (!champion)
        throw new NotFoundException('Risk Champion (utilisateur) introuvable.');
    }

    const dept = await this.prisma.departement.update({
      where: { id },
      data: dto,
    });

    if (actor) {
      await this.journalService.logAction({
        utilisateurId: actor.id,
        utilisateurNom: actor.nom,
        utilisateurRole: actor.role,
        action: TypeActionLog.MODIFICATION,
        entiteType: 'DEPARTEMENT',
        entiteId: id,
        entiteRef: `${dept.code} - ${dept.nom}`,
        details: { champs: Object.keys(dto) },
      });
    }

    return dept;
  }

  async remove(id: string, actor?: UserContext) {
    const dept = await this.prisma.departement.findUnique({
      where: { id },
      include: {
        _count: { select: { employes: true, sousDepartements: true } },
      },
    });
    if (!dept) throw new NotFoundException(`Département #${id} introuvable`);

    if (dept._count.sousDepartements > 0) {
      throw new BadRequestException(
        'Impossible de supprimer : ce département a des sous-départements. Supprimez-les d\'abord.',
      );
    }

    if (dept._count.employes > 0) {
      throw new BadRequestException(
        `Impossible de supprimer : ${dept._count.employes} utilisateur(s) sont rattaché(s) à ce département.`,
      );
    }

    try {
      const result = await this.prisma.departement.delete({ where: { id } });

      if (actor) {
        await this.journalService.logAction({
          utilisateurId: actor.id,
          utilisateurNom: actor.nom,
          utilisateurRole: actor.role,
          action: TypeActionLog.SUPPRESSION,
          entiteType: 'DEPARTEMENT',
          entiteId: id,
          entiteRef: `${dept.code} - ${dept.nom}`,
        });
      }

      return result;
    } catch (err) {
      throw new BadRequestException(
        `Suppression impossible : contraintes en base (${(err as Error).message}).`,
      );
    }
  }
}
