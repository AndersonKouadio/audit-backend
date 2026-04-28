import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUTHENTIFIE,
  ROLES_LECTURE_GLOBALE,
} from 'src/auth/constants/roles-matrix';
import { PiecesJointesService } from './pieces-jointes.service';
import type { Response } from 'express';
import * as path from 'path';

@ApiTags('Pièces Jointes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pieces-jointes')
export class PiecesJointesController {
  constructor(private readonly piecesJointesService: PiecesJointesService) {}

  // ── Upload d'un fichier ────────────────────────────────────────────────────

  @Post('upload')
  @Roles(...ROLES_AUTHENTIFIE)
  @ApiOperation({
    summary: 'Téléverser un fichier (PDF, image, Excel, Word, CSV, ZIP — max 10Mo)',
    description:
      'Paramètres requis en query : entiteType (AUDIT|POINT_AUDIT|ACTION_POINT|POINT_FRAUDE) + entiteId',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'entiteType', required: true, description: 'AUDIT | POINT_AUDIT | ACTION_POINT | POINT_FRAUDE' })
  @ApiQuery({ name: 'entiteId', required: true, description: 'ID de l\'entité' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined, // Memory storage — le service écrit sur disque
      limits: { fileSize: 10 * 1024 * 1024 }, // 10Mo
    }),
  )
  upload(
    @Req() req,
    @UploadedFile() file: any,
    @Query('entiteType') entiteType: string,
    @Query('entiteId') entiteId: string,
  ) {
    return this.piecesJointesService.telechargerFichier(
      file,
      entiteType,
      entiteId,
      req.user.id,
      req.user,
    );
  }

  // ── Lister les pièces jointes d'une entité ────────────────────────────────

  @Get()
  @Roles(...ROLES_LECTURE_GLOBALE)
  @ApiOperation({ summary: 'Lister les pièces jointes d\'une entité' })
  @ApiQuery({ name: 'entiteType', required: true })
  @ApiQuery({ name: 'entiteId', required: true })
  findByEntite(
    @Query('entiteType') entiteType: string,
    @Query('entiteId') entiteId: string,
  ) {
    return this.piecesJointesService.findByEntite(entiteType, entiteId);
  }

  // ── Télécharger un fichier ────────────────────────────────────────────────

  @Get('download/:filename')
  @Roles(...ROLES_LECTURE_GLOBALE)
  @ApiOperation({ summary: 'Télécharger un fichier par son nom' })
  async download(
    @Req() req,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // SÉCURITÉ : protection path traversal
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename || safeFilename.includes('..')) {
      throw new BadRequestException('Nom de fichier invalide');
    }

    // Vérification que le user a le droit de télécharger ce fichier
    // (existe en BDD + droits sur l'entité parente)
    await this.piecesJointesService.assertCanDownload(safeFilename, req.user);

    const filePath = this.piecesJointesService.getFilePath(safeFilename);
    const ext = path.extname(safeFilename).toLowerCase();

    // Types inlineables (PDF, images)
    const inlineTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    if (inlineTypes[ext]) {
      res.setHeader('Content-Type', inlineTypes[ext]);
      res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    res.sendFile(filePath);
  }

  // ── Supprimer une pièce jointe ────────────────────────────────────────────

  @Delete(':id')
  @Roles(...ROLES_AUTHENTIFIE)
  @ApiOperation({ summary: 'Supprimer une pièce jointe (auteur ou admin)' })
  supprimer(@Req() req, @Param('id') id: string) {
    return this.piecesJointesService.supprimer(id, req.user);
  }
}
