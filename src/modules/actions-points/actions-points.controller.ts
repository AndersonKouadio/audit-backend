import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActionsPointsService } from './actions-points.service';
import { CreateActionPointDto } from './dto/create-actions-point.dto';
import { UpdateActionPointDto } from './dto/update-actions-point.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUDIT_SENIOR_PLUS,
  ROLES_LECTURE_GLOBALE,
} from 'src/auth/constants/roles-matrix';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

@ApiTags('Actions Correctives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('actions-points')
export class ActionsPointsController {
  constructor(private readonly actionsPointsService: ActionsPointsService) {}

  @Post()
  @Roles(...ROLES_AUDIT_SENIOR_PLUS)
  @ApiOperation({ summary: 'Assigner une nouvelle action corrective' })
  create(@Body() dto: CreateActionPointDto) {
    return this.actionsPointsService.create(dto);
  }

  @Get()
  @Roles(...ROLES_LECTURE_GLOBALE) // était @Public — filtrage par scope dans le service
  @ApiOperation({
    summary: 'Lister les actions (par point, responsable ou statut)',
  })
  findAll(@Req() req, @Query() query: any) {
    return this.actionsPointsService.findAll(query, req.user);
  }

  @Patch(':id')
  // FIX : ajout EMPLOYE_METIER (Action Owner) + autres rôles audit
  // Le service vérifie l'ownership (responsableId === user.id) pour les rôles BU
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.MANAGER_METIER,
    RoleUtilisateur.RISK_CHAMPION,
    RoleUtilisateur.EMPLOYE_METIER, // ajouté : Action Owner peut MAJ son action
  )
  @ApiOperation({ summary: "Mettre à jour l'avancement d'une action" })
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateActionPointDto) {
    return this.actionsPointsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
  )
  @ApiOperation({ summary: 'Supprimer une action corrective' })
  remove(@Param('id') id: string) {
    return this.actionsPointsService.remove(id);
  }
}
