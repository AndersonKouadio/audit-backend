import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { FormulaireRafService } from './formulaire-raf.service';
import { CreateFormulaireRafDto } from './dto/create-formulaire-raf.dto';
import { ApprouverRafDto } from './dto/approuver-raf.dto';

@ApiTags('Formulaires RAF (Risk Accepted Form)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('formulaire-raf')
export class FormulaireRafController {
  constructor(private readonly rafService: FormulaireRafService) {}

  // ── Créer un formulaire RAF ────────────────────────────────────────────────
  // MANAGER_METIER initie le RAF (HoD accepte le risque), équipe audit peut aussi créer

  @Post()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.MANAGER_METIER,
    RoleUtilisateur.RISK_CHAMPION,
  )
  @ApiOperation({
    summary: 'Créer un formulaire RAF',
    description:
      "Crée un Formulaire d'Acceptation du Risque. Réservé aux managers métier et à l'équipe audit.",
  })
  creer(@Req() req, @Body() dto: CreateFormulaireRafDto) {
    return this.rafService.creer(dto, req.user);
  }

  // ── Lister les formulaires RAF ─────────────────────────────────────────────

  @Get()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.MANAGER_METIER,
    RoleUtilisateur.RISK_CHAMPION,
  )
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
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.MANAGER_METIER,
    RoleUtilisateur.RISK_CHAMPION,
  )
  @ApiOperation({ summary: 'Obtenir un formulaire RAF par son ID' })
  findOne(@Param('id') id: string) {
    return this.rafService.findOne(id);
  }

  // ── Approuver un formulaire RAF ───────────────────────────────────────────
  // HOD = MANAGER_METIER | GM/CEO/COMITE = DIRECTEUR_AUDIT ou ADMIN
  // La validation du rôle par niveau est effectuée dans le service

  @Patch(':id/approuver')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.MANAGER_METIER,
  )
  @ApiOperation({
    summary: 'Approuver un formulaire RAF',
    description:
      "Enregistre l'approbation d'un niveau hiérarchique (HOD → GM → CEO → COMITE). " +
      "Chaque niveau doit être approuvé dans l'ordre. " +
      'HOD = MANAGER_METIER, GM/CEO/COMITE = DIRECTEUR_AUDIT ou ADMIN.',
  })
  approuver(@Req() req, @Param('id') id: string, @Body() dto: ApprouverRafDto) {
    return this.rafService.approuver(id, dto, req.user);
  }

  // ── Lier un point d'audit à un RAF existant ───────────────────────────────

  @Patch(':id/lier-point/:pointAuditId')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.MANAGER_METIER,
  )
  @ApiOperation({
    summary: "Lier un point d'audit existant à ce formulaire RAF",
  })
  lierPointAudit(
    @Param('id') id: string,
    @Param('pointAuditId') pointAuditId: string,
  ) {
    return this.rafService.lierPointAudit(id, pointAuditId);
  }

  // ── Annuler / supprimer un formulaire RAF ─────────────────────────────────

  @Delete(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
  )
  @ApiOperation({
    summary: 'Annuler un formulaire RAF',
    description:
      "Suppression réservée à l'ADMIN ou DIRECTEUR_AUDIT. " +
      "Un RAF déjà validé (Comité d'Audit) ne peut pas être supprimé.",
  })
  remove(@Req() req, @Param('id') id: string) {
    return this.rafService.remove(id, req.user);
  }
}
