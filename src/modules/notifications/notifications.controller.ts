import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ── Liste des notifications de l'utilisateur connecté ─────────────────────

  @Get()
  @ApiOperation({ summary: "Liste des notifications de l'utilisateur connecté" })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'nonLues', required: false, type: Boolean, description: 'true = uniquement non lues' })
  findMy(
    @Req() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('nonLues') nonLues?: string,
  ) {
    return this.notificationsService.findByUser(req.user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      luSeulement: nonLues === 'true' ? false : undefined,
    });
  }

  // ── Compteur de notifications non lues ─────────────────────────────────────

  @Get('count')
  @ApiOperation({ summary: 'Nombre de notifications non lues' })
  async countUnread(@Req() req) {
    const count = await this.notificationsService.compterNonLues(req.user.id);
    return { nonLues: count };
  }

  // ── Marquer une notification comme lue ─────────────────────────────────────

  @Patch(':id/lue')
  @ApiOperation({ summary: 'Marquer une notification comme lue' })
  marquerLue(@Req() req, @Param('id') id: string) {
    return this.notificationsService.marquerLue(id, req.user.id);
  }

  // ── Marquer toutes les notifications comme lues ─────────────────────────────

  @Patch('tout-lire')
  @ApiOperation({ summary: 'Marquer toutes les notifications comme lues' })
  marquerToutesLues(@Req() req) {
    return this.notificationsService.marquerToutesLues(req.user.id);
  }
}
