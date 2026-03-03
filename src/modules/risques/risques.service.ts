import { Injectable, NotFoundException } from '@nestjs/common';
import { PaginationResponseDto } from 'src/common/dto/pagination-response.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JournalAuditService } from 'src/modules/journal-audit/journal-audit.service';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { CreateRisqueDto } from './dto/create-risque.dto';
import { UpdateRisqueDto } from './dto/update-risque.dto';
import { RisqueQueryDto } from './dto/risque-query.dto';

@Injectable()
export class RisquesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journalAudit: JournalAuditService,
  ) {}

  async findAll(query: RisqueQueryDto): Promise<PaginationResponseDto<any>> {
    const { page = 1, limit = 10, search, statut, categorie, departementId } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      AND: [
        search
          ? {
              OR: [
                { titre: { contains: search, mode: 'insensitive' } },
                { reference: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        statut ? { statut } : {},
        categorie ? { categorie } : {},
        departementId ? { departementId } : {},
      ],
    };

    const [total, data] = await Promise.all([
      this.prisma.risque.count({ where }),
      this.prisma.risque.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          departement: { select: { nom: true, code: true } },
          responsable: { select: { nom: true, prenom: true } },
          createur: { select: { nom: true, prenom: true } },
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
    const risque = await this.prisma.risque.findUnique({
      where: { id },
      include: {
        departement: { select: { nom: true, code: true } },
        responsable: { select: { id: true, nom: true, prenom: true, email: true } },
        createur: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!risque) {
      throw new NotFoundException(`Risque ${id} introuvable`);
    }

    return risque;
  }

  async create(createurId: string, dto: CreateRisqueDto, utilisateur?: any) {
    const count = await this.prisma.risque.count();
    const reference = `RSQ-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const score = dto.probabilite * dto.impact;

    const risque = await this.prisma.risque.create({
      data: {
        reference,
        titre: dto.titre,
        description: dto.description,
        categorie: dto.categorie,
        probabilite: dto.probabilite,
        impact: dto.impact,
        score,
        mesuresControle: dto.mesuresControle,
        planTraitement: dto.planTraitement,
        departementId: dto.departementId,
        responsableId: dto.responsableId,
        createurId,
        dateProchaineRevue: dto.dateProchaineRevue ? new Date(dto.dateProchaineRevue) : undefined,
      },
      include: {
        departement: { select: { nom: true, code: true } },
        responsable: { select: { nom: true, prenom: true } },
      },
    });

    await this.journalAudit.logAction({
      utilisateurId: utilisateur?.id,
      utilisateurNom: utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : undefined,
      utilisateurRole: utilisateur?.role,
      action: TypeActionLog.CREATION,
      entiteType: 'RISQUE',
      entiteId: risque.id,
      entiteRef: risque.reference,
      details: { titre: risque.titre, categorie: risque.categorie, score },
    });

    return risque;
  }

  async update(id: string, dto: UpdateRisqueDto, utilisateur?: any) {
    const existing = await this.prisma.risque.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Risque ${id} introuvable`);

    const probabilite = dto.probabilite ?? existing.probabilite;
    const impact = dto.impact ?? existing.impact;
    const score = probabilite * impact;

    const risque = await this.prisma.risque.update({
      where: { id },
      data: {
        ...dto,
        score,
        dateProchaineRevue: dto.dateProchaineRevue ? new Date(dto.dateProchaineRevue) : undefined,
      },
      include: {
        departement: { select: { nom: true, code: true } },
        responsable: { select: { nom: true, prenom: true } },
      },
    });

    await this.journalAudit.logAction({
      utilisateurId: utilisateur?.id,
      utilisateurNom: utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : undefined,
      utilisateurRole: utilisateur?.role,
      action: TypeActionLog.MODIFICATION,
      entiteType: 'RISQUE',
      entiteId: risque.id,
      entiteRef: risque.reference,
      details: { modifications: dto },
    });

    return risque;
  }

  async remove(id: string, utilisateur?: any) {
    const existing = await this.prisma.risque.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Risque ${id} introuvable`);

    await this.prisma.risque.delete({ where: { id } });

    await this.journalAudit.logAction({
      utilisateurId: utilisateur?.id,
      utilisateurNom: utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : undefined,
      utilisateurRole: utilisateur?.role,
      action: TypeActionLog.SUPPRESSION,
      entiteType: 'RISQUE',
      entiteId: existing.id,
      entiteRef: existing.reference,
      details: { titre: existing.titre },
    });

    return { message: 'Risque supprimé avec succès' };
  }
}
