import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UpdateParametresDto } from './dto/update-parametres.dto';
import { ParametresSystemeService } from './parametres-systeme.service';

@ApiTags('Paramètres Système')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parametres-systeme')
export class ParametresSystemeController {
  constructor(private readonly service: ParametresSystemeService) {}

  // ── Lire les paramètres actuels ──────────────────────────────────────────

  @Get()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  )
  @ApiOperation({ summary: 'Obtenir les paramètres système' })
  obtenir() {
    return this.service.obtenir();
  }

  // ── Mettre à jour les paramètres ─────────────────────────────────────────

  @Patch()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour les paramètres système (ADMIN uniquement)' })
  modifier(@Body() dto: UpdateParametresDto) {
    return this.service.modifier(dto);
  }
}
