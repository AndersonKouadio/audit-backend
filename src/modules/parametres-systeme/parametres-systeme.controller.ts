import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateParametresDto } from './dto/update-parametres.dto';
import { ParametresSystemeService } from './parametres-systeme.service';

@ApiTags('Paramètres Système')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('parametres-systeme')
export class ParametresSystemeController {
  constructor(private readonly service: ParametresSystemeService) {}

  // ── Lire les paramètres actuels ──────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Obtenir les paramètres système' })
  obtenir() {
    return this.service.obtenir();
  }

  // ── Mettre à jour les paramètres ─────────────────────────────────────────

  @Patch()
  @ApiOperation({ summary: 'Mettre à jour les paramètres système' })
  modifier(@Body() dto: UpdateParametresDto) {
    return this.service.modifier(dto);
  }
}
