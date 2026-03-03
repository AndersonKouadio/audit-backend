import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'KPIs globaux et données analytiques du tableau de bord' })
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('performance')
  @ApiOperation({ summary: 'Performance des auditeurs (missions, points, taux de clôture)' })
  getPerformance() {
    return this.dashboardService.getPerformance();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Alertes in-app pour l\'utilisateur courant' })
  getAlerts(@Req() req: any) {
    return this.dashboardService.getAlerts(req.user.id);
  }
}
