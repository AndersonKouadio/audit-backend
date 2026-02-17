import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActionsPointsService } from './actions-points.service';
import { CreateActionPointDto } from './dto/create-actions-point.dto';
import { UpdateActionPointDto } from './dto/update-actions-point.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

@ApiTags('Actions Correctives')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('actions-points')
export class ActionsPointsController {
  constructor(private readonly actionsPointsService: ActionsPointsService) {}

  @Post()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.AUDITEUR_SENIOR,
  )
  @ApiOperation({ summary: 'Assigner une nouvelle action corrective' })
  create(@Body() dto: CreateActionPointDto) {
    return this.actionsPointsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les actions (par point, responsable ou statut)',
  })
  findAll(@Query() query: any) {
    return this.actionsPointsService.findAll(query);
  }

  @Patch(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.MANAGER_METIER,
    RoleUtilisateur.RISK_CHAMPION,
  )
  @ApiOperation({ summary: "Mettre à jour l'avancement d'une action" })
  update(@Param('id') id: string, @Body() dto: UpdateActionPointDto) {
    return this.actionsPointsService.update(id, dto);
  }
}
