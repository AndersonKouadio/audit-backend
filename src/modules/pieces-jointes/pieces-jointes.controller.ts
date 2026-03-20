import {
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
import { PiecesJointesService } from './pieces-jointes.service';
import type { Response } from 'express';
import * as path from 'path';

@ApiTags('Pièces Jointes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pieces-jointes')
export class PiecesJointesController {
  constructor(private readonly piecesJointesService: PiecesJointesService) {}

  // ── Upload d'un fichier ────────────────────────────────────────────────────

  @Post('upload')
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
    );
  }

  // ── Lister les pièces jointes d'une entité ────────────────────────────────

  @Get()
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
  @ApiOperation({ summary: 'Télécharger un fichier par son nom' })
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.piecesJointesService.getFilePath(filename);
    const ext = path.extname(filename).toLowerCase();

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
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    res.sendFile(filePath);
  }

  // ── Supprimer une pièce jointe ────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer une pièce jointe' })
  supprimer(@Req() req, @Param('id') id: string) {
    return this.piecesJointesService.supprimer(id, req.user.id);
  }
}
