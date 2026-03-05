import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';

@Injectable()
export class CommentairesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createurId: string, dto: CreateCommentaireDto) {
    const { typeEntite, entiteId, texte, estInterne = false } = dto;

    // Préparer les relations optionnelles selon le type d'entité
    const relationsEntite: Record<string, any> = {};
    if (typeEntite === 'POINT_AUDIT') {
      relationsEntite.pointAuditId = entiteId;
    } else if (typeEntite === 'POINT_FRAUDE') {
      relationsEntite.pointFraudeId = entiteId;
    } else if (typeEntite === 'RISQUE') {
      // Pas de FK Prisma pour les risques — typeEntite + entiteId suffisent
    }

    return this.prisma.commentaire.create({
      data: {
        typeEntite,
        entiteId,
        texte,
        estInterne,
        creePar: createurId,
        ...relationsEntite,
      },
    });
  }

  async findByEntite(typeEntite: string, entiteId: string) {
    return this.prisma.commentaire.findMany({
      where: { typeEntite, entiteId },
      orderBy: { dateCreation: 'asc' },
    });
  }

  async remove(id: string) {
    return this.prisma.commentaire.delete({ where: { id } });
  }
}
