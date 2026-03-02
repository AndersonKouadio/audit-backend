import { Controller, Get, Post, Body, Query, UseGuards, Param, Patch } from '@nestjs/common';
import { AuditsService } from './audits.service';
import { CreateAuditDto } from './dto/create-audit.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { UpdateAuditDto } from './dto/update-audit.dto';

@ApiTags("Missions d'Audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audits')
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) { }

  @Post()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT)
  @ApiOperation({ summary: "Créer et planifier une nouvelle mission d'audit" })
  create(@Body() createAuditDto: CreateAuditDto) {
    return this.auditsService.create(createAuditDto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des audits avec filtres' })
  findAll(@Query() query: AuditQueryDto) {
    return this.auditsService.findAll(query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Liste paginée des audits avec filtres' })
  findOne(@Param('id') id: string) {
    return this.auditsService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT, RoleUtilisateur.CHEF_MISSION)
  @ApiOperation({ summary: "Modifier une mission d'audit" })
  update(@Param('id') id: string, @Body() dto: UpdateAuditDto) {
    return this.auditsService.update(id, dto);
  }
}
