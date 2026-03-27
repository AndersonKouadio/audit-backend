import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { PointsAuditService } from './points-audit.service';
import { CreatePointAuditDto } from './dto/create-points-audit.dto';
import { PointQueryDto } from './dto/point-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Public } from 'src/auth/decorators/public.decorator';
import { RoleUtilisateur, StatutPoint } from 'src/generated/prisma/enums';
import { UpdatePointsAuditDto } from './dto/update-points-audit.dto';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

// ─── DTOs inline pour les endpoints de changement de statut ───────────────────

class ChangerStatutBuDto {
  @ApiProperty({ enum: StatutPoint, description: 'Statut déclaré par la BU' })
  @IsEnum(StatutPoint)
  statutBu: StatutPoint;

  @ApiProperty({ description: 'Justification obligatoire (min. 5 caractères)', minLength: 5 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  commentaireStatutBu: string;
}

class ChangerStatutAuditDto {
  @ApiProperty({ enum: StatutPoint, description: 'Statut officiel Audit' })
  @IsEnum(StatutPoint)
  statut: StatutPoint;

  @ApiProperty({ required: false, description: 'Nom du Manager qui valide la clôture' })
  @IsOptional()
  @IsString()
  revidePar?: string;

  @ApiProperty({ required: false, description: 'ID du formulaire RAF (requis pour FERME_RISQUE_ACCEPTE)' })
  @IsOptional()
  @IsString()
  formulaireRisqueId?: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@ApiTags("Points d'Audit (Findings)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('points-audit')
export class PointsAuditController {
  constructor(private readonly pointsAuditService: PointsAuditService) {}

  // ── Création ──────────────────────────────────────────────────────────────

  @Post()
  @Roles(
    RoleUtilisateur.AUDITEUR_JUNIOR,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.ADMIN,
  )
  @ApiOperation({ summary: "Créer un nouveau point d'audit (Constat)" })
  create(@Req() req, @Body() dto: CreatePointAuditDto) {
    return this.pointsAuditService.create(req.user.id, dto, req.user);
  }

  // ── Liste paginée ─────────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liste paginée des points avec filtres' })
  findAll(@Query() query: PointQueryDto) {
    return this.pointsAuditService.findAll(query);
  }

  // ── Détail ────────────────────────────────────────────────────────────────

  @Get(':id')
  @Public()
  @ApiOperation({ summary: "Détails complets d'un point (avec actions, commentaires, historique)" })
  findOne(@Param('id') id: string) {
    return this.pointsAuditService.findOne(id);
  }

  // ── Mise à jour générale (équipe Audit uniquement) ────────────────────────

  @Patch(':id')
  @Roles(
    RoleUtilisateur.AUDITEUR_JUNIOR,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.ADMIN,
  )
  @ApiOperation({ summary: "Mettre à jour un constat (équipe Audit)" })
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdatePointsAuditDto) {
    return this.pointsAuditService.update(id, dto, req.user);
  }

  // ── Changement de statut BU (Risk Champion / Manager Métier) ─────────────

  @Patch(':id/statut-bu')
  @Roles(
    RoleUtilisateur.RISK_CHAMPION,
    RoleUtilisateur.MANAGER_METIER,
    RoleUtilisateur.EMPLOYE_METIER,
  )
  @ApiOperation({
    summary: 'Déclarer un statut BU avec justification obligatoire',
    description:
      'Réservé aux membres de la BU (Risk Champion, Manager Métier, Employé Métier). ' +
      'Un commentaire justificatif est obligatoire.',
  })
  @ApiBody({ type: ChangerStatutBuDto })
  changerStatutBu(@Req() req, @Param('id') id: string, @Body() dto: ChangerStatutBuDto) {
    return this.pointsAuditService.changerStatutBU(
      id,
      dto.statutBu,
      dto.commentaireStatutBu,
      req.user,
    );
  }

  // ── Changement de statut officiel Audit ───────────────────────────────────

  @Patch(':id/statut')
  @Roles(
    RoleUtilisateur.AUDITEUR_JUNIOR,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.ADMIN,
  )
  @ApiOperation({
    summary: "Modifier le statut officiel Audit d'un constat",
    description:
      "Réservé à l'équipe Audit. Enregistre automatiquement les dates (CPF, résolution) " +
      'et la revue de clôture pour les Managers.',
  })
  @ApiBody({ type: ChangerStatutAuditDto })
  changerStatutAudit(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: ChangerStatutAuditDto,
  ) {
    return this.pointsAuditService.changerStatutAudit(
      id,
      dto.statut,
      req.user,
      dto.revidePar,
      dto.formulaireRisqueId,
    );
  }

  // ── Suppression ───────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
  )
  @ApiOperation({ summary: "Supprimer un point d'audit" })
  remove(@Req() req, @Param('id') id: string) {
    return this.pointsAuditService.remove(id, req.user);
  }

  // ── Import Batch Excel ────────────────────────────────────────────────────

  @Post('batch')
  @Roles(
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.ADMIN,
  )
  @ApiOperation({ summary: "Importation massive de constats pour une mission" })
  createMany(@Req() req, @Body() dtos: CreatePointAuditDto[]) {
    return this.pointsAuditService.createMany(req.user.id, dtos, req.user);
  }
}
