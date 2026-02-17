import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { PointsAuditService } from './points-audit.service';
import { CreatePointAuditDto } from './dto/create-points-audit.dto';
import { PointQueryDto } from './dto/point-query.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

@ApiTags("Points d'Audit (Findings)")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('points-audit')
export class PointsAuditController {
  constructor(private readonly pointsAuditService: PointsAuditService) {}

  @Post()
  @Roles(
    RoleUtilisateur.AUDITEUR_JUNIOR,
    RoleUtilisateur.AUDITEUR_SENIOR,
    RoleUtilisateur.CHEF_MISSION,
  )
  @ApiOperation({ summary: "Créer un nouveau point d'audit (Constat)" })
  create(@Req() req, @Body() dto: CreatePointAuditDto) {
    return this.pointsAuditService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginée des points avec filtres' })
  findAll(@Query() query: PointQueryDto) {
    return this.pointsAuditService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Détails complets d'un point (avec actions et historique)",
  })
  findOne(@Param('id') id: string) {
    return this.pointsAuditService.findOne(id);
  }
}
