import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FormulaireRafService } from './formulaire-raf.service';
import { CreateFormulaireRafDto } from './dto/create-formulaire-raf.dto';
import { ApprouverRafDto } from './dto/approuver-raf.dto';

@ApiTags('Formulaires RAF (Risk Accepted Form)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('formulaire-raf')
export class FormulaireRafController {
  constructor(private readonly rafService: FormulaireRafService) {}

  // ── Créer un formulaire RAF ────────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Créer un formulaire RAF',
    description:
      'Crée un Formulaire d\'Acceptation du Risque et le lie optionnellement à des points d\'audit.',
  })
  creer(@Body() dto: CreateFormulaireRafDto) {
    return this.rafService.creer(dto);
  }

  // ── Lister les formulaires RAF ─────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Lister tous les formulaires RAF' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.rafService.findAll({ page: Number(page) || 1, limit: Number(limit) || 20, search });
  }

  // ── Obtenir un formulaire RAF ──────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un formulaire RAF par son ID' })
  findOne(@Param('id') id: string) {
    return this.rafService.findOne(id);
  }

  // ── Approuver un formulaire RAF ───────────────────────────────────────────

  @Patch(':id/approuver')
  @ApiOperation({
    summary: 'Approuver un formulaire RAF',
    description:
      'Enregistre l\'approbation d\'un niveau hiérarchique (HOD → GM → CEO → COMITE). ' +
      'Chaque niveau doit être approuvé dans l\'ordre.',
  })
  approuver(@Param('id') id: string, @Body() dto: ApprouverRafDto) {
    return this.rafService.approuver(id, dto);
  }

  // ── Lier un point d'audit à un RAF existant ───────────────────────────────

  @Patch(':id/lier-point/:pointAuditId')
  @ApiOperation({
    summary: 'Lier un point d\'audit existant à ce formulaire RAF',
  })
  lierPointAudit(
    @Param('id') id: string,
    @Param('pointAuditId') pointAuditId: string,
  ) {
    return this.rafService.lierPointAudit(id, pointAuditId);
  }
}
