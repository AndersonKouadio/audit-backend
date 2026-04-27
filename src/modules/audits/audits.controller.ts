import { Controller, Get, Post, Body, Query, UseGuards, Param, Patch, Delete, Req } from '@nestjs/common';
import { AuditsService } from './audits.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUDIT_MANAGEMENT,
  ROLES_LECTURE_GLOBALE,
} from 'src/auth/constants/roles-matrix';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { UpdateAuditDto } from './dto/update-audit.dto';

@ApiTags("Missions d'Audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audits')
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) { }

  @Post()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT, // ajouté : peut planifier missions de SON département
  )
  @ApiOperation({ summary: "Créer et planifier une nouvelle mission d'audit" })
  create(@Req() req, @Body() createAuditDto: CreateAuditDto) {
    return this.auditsService.create(createAuditDto, req.user);
  }

  @Get()
  @Roles(...ROLES_LECTURE_GLOBALE) // était @Public — lecture limitée + filtrage par scope dans service
  @ApiOperation({ summary: 'Liste paginée des audits avec filtres' })
  findAll(@Req() req, @Query() query: AuditQueryDto) {
    return this.auditsService.findAll(query, req.user);
  }

  @Get(':id')
  @Roles(...ROLES_LECTURE_GLOBALE) // était @Public
  @ApiOperation({ summary: "Détails d'une mission d'audit" })
  findOne(@Req() req, @Param('id') id: string) {
    return this.auditsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles(...ROLES_AUDIT_MANAGEMENT) // ADMIN, DIRECTEUR, CHEF_DEPT_AUDIT, CHEF_MISSION
  @ApiOperation({ summary: "Modifier une mission d'audit" })
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateAuditDto) {
    return this.auditsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  )
  @ApiOperation({ summary: "Supprimer une mission d'audit" })
  remove(@Req() req, @Param('id') id: string) {
    return this.auditsService.remove(id, req.user);
  }

  // ─── Gestion de l'équipe ──────────────────────────────────────────────────

  @Post(':id/equipe/:userId')
  @Roles(...ROLES_AUDIT_MANAGEMENT)
  @ApiOperation({ summary: "Ajouter un membre à l'équipe de la mission" })
  addTeamMember(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.auditsService.addTeamMember(id, userId, req.user);
  }

  @Delete(':id/equipe/:userId')
  @Roles(...ROLES_AUDIT_MANAGEMENT)
  @ApiOperation({ summary: "Retirer un membre de l'équipe de la mission" })
  removeTeamMember(
    @Req() req,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.auditsService.removeTeamMember(id, userId, req.user);
  }
}
