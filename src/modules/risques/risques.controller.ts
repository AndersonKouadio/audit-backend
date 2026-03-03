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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { RisquesService } from './risques.service';
import { CreateRisqueDto } from './dto/create-risque.dto';
import { UpdateRisqueDto } from './dto/update-risque.dto';
import { RisqueQueryDto } from './dto/risque-query.dto';

@ApiTags('Risk Management – Risques')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('risques')
export class RisquesController {
  constructor(private readonly risquesService: RisquesService) {}

  @Post()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.RISK_CHAMPION,
  )
  @ApiOperation({ summary: 'Créer un nouveau risque dans le registre' })
  create(@Req() req: any, @Body() dto: CreateRisqueDto) {
    return this.risquesService.create(req.user.id, dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des risques avec filtres' })
  findAll(@Query() query: RisqueQueryDto) {
    return this.risquesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails complets d\'un risque' })
  findOne(@Param('id') id: string) {
    return this.risquesService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.RISK_CHAMPION,
  )
  @ApiOperation({ summary: 'Mettre à jour un risque (statut, détails, score)' })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRisqueDto) {
    return this.risquesService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT)
  @ApiOperation({ summary: 'Supprimer un risque' })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.risquesService.remove(id, req.user);
  }
}
