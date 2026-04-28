import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_EXPORT_OPERATIONNEL,
  ROLES_EXPORT_SENSIBLE,
} from 'src/auth/constants/roles-matrix';
import { TypeActionLog } from 'src/generated/prisma/enums';
import { ExportService } from './export.service';
import { JournalAuditService } from '../journal-audit/journal-audit.service';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Export Excel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly journalService: JournalAuditService,
  ) {}

  private async logExport(req: any, exportType: string, filters: Record<string, any> = {}) {
    if (!req?.user?.id) return;
    await this.journalService.logAction({
      utilisateurId: req.user.id,
      utilisateurNom: req.user.nom ?? `${req.user.prenom ?? ''} ${req.user.nom ?? ''}`.trim(),
      utilisateurRole: req.user.role,
      action: TypeActionLog.EXPORT_EXCEL,
      entiteType: 'EXPORT',
      entiteId: exportType,
      entiteRef: exportType,
      details: filters,
    });
  }

  @Get('points-audit')
  @Roles(...ROLES_EXPORT_OPERATIONNEL)
  @ApiOperation({ summary: "Exporter les points d'audit en Excel" })
  async exportPointsAudit(
    @Req() req,
    @Query('auditId') auditId: string,
    @Query('statut') statut: string,
    @Query('departementId') departementId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportPointsAudit({ auditId, statut, departementId });
    await this.logExport(req, 'points-audit', { auditId, statut, departementId });
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="points-audit-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('cas-fraude')
  @Roles(...ROLES_EXPORT_SENSIBLE)
  @ApiOperation({ summary: 'Exporter les cas de fraude (FRM) en Excel' })
  async exportCasFraude(
    @Req() req,
    @Query('statut') statut: string,
    @Query('departementId') departementId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportCasFraude();
    await this.logExport(req, 'cas-fraude', { statut, departementId });
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="cas-fraude-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('ageing')
  @Roles(...ROLES_EXPORT_OPERATIONNEL)
  @ApiOperation({ summary: "Rapport d'ageing des points en retard" })
  async exportAgeing(@Req() req, @Res() res: Response) {
    const buffer = await this.exportService.exportAgeing();
    await this.logExport(req, 'ageing');
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="rapport-ageing-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('risques')
  @Roles(...ROLES_EXPORT_SENSIBLE)
  @ApiOperation({ summary: 'Exporter le registre des risques en Excel' })
  async exportRisques(@Req() req, @Res() res: Response) {
    const buffer = await this.exportService.exportRisques();
    await this.logExport(req, 'risques');
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="registre-risques-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
