import {
  Body,
  Controller,
  Delete,
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
import { CasFraudeService } from './cas-fraude.service';
import { CasFraudeQueryDto } from './dto/cas-fraude-query.dto';
import { CreateCasFraudeDto } from './dto/create-cas-fraude.dto';
import { UpdateCasFraudeDto } from './dto/update-cas-fraude.dto';

@ApiTags('FRM – Cas de Fraude')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cas-fraude')
export class CasFraudeController {
  constructor(private readonly casFraudeService: CasFraudeService) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.AUDITEUR_SENIOR, RoleUtilisateur.CHEF_MISSION)
  @ApiOperation({ summary: 'Créer un nouveau cas de fraude (FRM)' })
  create(@Body() dto: CreateCasFraudeDto) {
    return this.casFraudeService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des cas de fraude avec filtres' })
  findAll(@Query() query: CasFraudeQueryDto) {
    return this.casFraudeService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails complets d\'un cas de fraude avec ses points' })
  findOne(@Param('id') id: string) {
    return this.casFraudeService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.AUDITEUR_SENIOR, RoleUtilisateur.CHEF_MISSION)
  @ApiOperation({ summary: 'Mettre à jour un cas de fraude (statut, détails)' })
  update(@Param('id') id: string, @Body() dto: UpdateCasFraudeDto) {
    return this.casFraudeService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Supprimer un cas de fraude' })
  remove(@Param('id') id: string) {
    return this.casFraudeService.remove(id);
  }
}
