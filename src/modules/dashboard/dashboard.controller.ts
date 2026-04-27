import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUTHENTIFIE,
  ROLES_LECTURE_GLOBALE,
} from 'src/auth/constants/roles-matrix';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @Roles(...ROLES_LECTURE_GLOBALE)
  @ApiOperation({ summary: 'KPIs globaux et données analytiques du tableau de bord' })
  getStats(@Req() req: any) {
    return this.dashboardService.getStats(req.user);
  }

  @Get('performance')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
    RoleUtilisateur.CHEF_MISSION,
    RoleUtilisateur.LECTURE_SEULE,
  )
  @ApiOperation({ summary: 'Performance des auditeurs (missions, points, taux de clôture)' })
  getPerformance() {
    return this.dashboardService.getPerformance();
  }

  @Get('alerts')
  @Roles(...ROLES_AUTHENTIFIE)
  @ApiOperation({ summary: "Alertes in-app pour l'utilisateur courant" })
  getAlerts(@Req() req: any) {
    return this.dashboardService.getAlerts(req.user.id, req.user.role);
  }
}
