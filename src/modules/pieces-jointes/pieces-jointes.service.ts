import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// Entités acceptées pour les pièces jointes
const ENTITES_VALIDES = ['AUDIT', 'POINT_AUDIT', 'ACTION_POINT', 'POINT_FRAUDE'] as const;
type EntiteType = (typeof ENTITES_VALIDES)[number];

// Mapping entiteType → champ Prisma
const CHAMP_RELATION: Record<EntiteType, string> = {
  AUDIT: 'auditId',
  POINT_AUDIT: 'pointAuditId',
  ACTION_POINT: 'actionPointId',
  POINT_FRAUDE: 'pointFraudeId',
};

// Types MIME autorisés
const TYPES_AUTORISES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/zip',
];

const TAILLE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class PiecesJointesService {
  private readonly uploadsDir: string;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    this.baseUrl = this.config.get<string>('APP_URL', 'http://localhost:3001');

    // Créer le dossier uploads s'il n'existe pas
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // ─── Téléverser un fichier ────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async telechargerFichier(
    file: any, // Express.Multer.File — nécessite npm install @types/multer pour le typage strict
    entiteType: string,
    entiteId: string,
    televerseePar: string,
  ) {
    // Validation du type d'entité
    if (!ENTITES_VALIDES.includes(entiteType as EntiteType)) {
      throw new BadRequestException(
        `Type d'entité invalide. Valeurs acceptées : ${ENTITES_VALIDES.join(', ')}`,
      );
    }

    // Validation du type MIME
    if (!TYPES_AUTORISES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé : ${file.mimetype}. Types acceptés : PDF, images, Excel, Word, CSV, ZIP.`,
      );
    }

    // Validation de la taille
    if (file.size > TAILLE_MAX_BYTES) {
      throw new BadRequestException(
        `Fichier trop volumineux : ${Math.round(file.size / 1024 / 1024)}Mo. Maximum : 10Mo.`,
      );
    }

    // Nom unique pour le fichier sur disque
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(this.uploadsDir, safeName);

    // Écrire le fichier sur disque
    fs.writeFileSync(filePath, file.buffer);

    const urlFichier = `/uploads/${safeName}`;
    const champRelation = CHAMP_RELATION[entiteType as EntiteType];

    const piece = await this.prisma.pieceJointe.create({
      data: {
        nomFichier: file.originalname,
        urlFichier,
        typeMime: file.mimetype,
        taille: file.size,
        televerseePar,
        [champRelation]: entiteId,
      },
    });

    return piece;
  }

  // ─── Lister les pièces jointes d'une entité ───────────────────────────────

  async findByEntite(entiteType: string, entiteId: string) {
    if (!ENTITES_VALIDES.includes(entiteType as EntiteType)) {
      throw new BadRequestException(`Type d'entité invalide.`);
    }

    const champRelation = CHAMP_RELATION[entiteType as EntiteType];

    return this.prisma.pieceJointe.findMany({
      where: { [champRelation]: entiteId },
      orderBy: { dateAjout: 'desc' },
    });
  }

  // ─── Supprimer une pièce jointe ───────────────────────────────────────────

  async supprimer(id: string, userId: string) {
    const piece = await this.prisma.pieceJointe.findUnique({ where: { id } });
    if (!piece) throw new NotFoundException('Pièce jointe introuvable.');

    // Seul le créateur (ou l'admin) peut supprimer
    if (piece.televerseePar !== userId) {
      throw new ForbiddenException(
        "Vous ne pouvez supprimer que les fichiers que vous avez téléversés.",
      );
    }

    // Supprimer le fichier du disque
    const filename = path.basename(piece.urlFichier);
    const filePath = path.join(this.uploadsDir, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.prisma.pieceJointe.delete({ where: { id } });
    return { success: true, message: 'Fichier supprimé.' };
  }

  // ─── Obtenir le chemin physique d'un fichier (pour le téléchargement) ────

  getFilePath(filename: string): string {
    const filePath = path.join(this.uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier introuvable.');
    }
    return filePath;
  }
}
