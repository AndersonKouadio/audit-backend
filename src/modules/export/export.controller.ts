import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { ExportService } from './export.service';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Export Excel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('points-audit')
  @ApiOperation({ summary: "Exporter les points d'audit en Excel" })
  async exportPointsAudit(
    @Query('auditId') auditId: string,
    @Query('statut') statut: string,
    @Query('departementId') departementId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportPointsAudit({ auditId, statut, departementId });
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="points-audit-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('cas-fraude')
  @ApiOperation({ summary: 'Exporter les cas de fraude (FRM) en Excel' })
  async exportCasFraude(
    @Query('statut') statut: string,
    @Query('departementId') departementId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportCasFraude({ statut, departementId });
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="cas-fraude-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('ageing')
  @ApiOperation({ summary: "Rapport d'ageing des points en retard" })
  async exportAgeing(@Res() res: Response) {
    const buffer = await this.exportService.exportAgeing();
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="rapport-ageing-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('risques')
  @ApiOperation({ summary: 'Exporter le registre des risques en Excel' })
  async exportRisques(@Res() res: Response) {
    const buffer = await this.exportService.exportRisques();
    res.set({
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="registre-risques-${Date.now()}.xlsx"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
