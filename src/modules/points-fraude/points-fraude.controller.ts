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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { CreatePointFraudeDto } from './dto/create-point-fraude.dto';
import { PointFraudeQueryDto } from './dto/point-fraude-query.dto';
import { UpdatePointFraudeDto } from './dto/update-point-fraude.dto';
import { PointsFraudeService } from './points-fraude.service';

@ApiTags('FRM – Points de Fraude')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('points-fraude')
export class PointsFraudeController {
  constructor(private readonly pointsFraudeService: PointsFraudeService) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.AUDITEUR_SENIOR, RoleUtilisateur.CHEF_MISSION)
  @ApiOperation({ summary: 'Créer un point de fraude pour un cas FRM' })
  create(@Body() dto: CreatePointFraudeDto) {
    return this.pointsFraudeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des points de fraude' })
  findAll(@Query() query: PointFraudeQueryDto) {
    return this.pointsFraudeService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: "Détails d'un point de fraude avec historique" })
  findOne(@Param('id') id: string) {
    return this.pointsFraudeService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.AUDITEUR_SENIOR, RoleUtilisateur.CHEF_MISSION)
  @ApiOperation({ summary: 'Mettre à jour un point de fraude (statut, détails)' })
  update(@Param('id') id: string, @Body() dto: UpdatePointFraudeDto) {
    return this.pointsFraudeService.update(id, dto);
  }
}
