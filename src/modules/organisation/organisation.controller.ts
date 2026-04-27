import { Controller, Get, Post, Body, Patch, UseGuards } from '@nestjs/common';
import { OrganisationService } from './organisation.service';
import { SetupOrganisationDto } from './dto/setup-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUTHENTIFIE,
  ROLES_GESTION_USERS,
} from 'src/auth/constants/roles-matrix';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

@ApiTags('Organisation & Setup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organisation')
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  @Get()
  @Roles(...ROLES_AUTHENTIFIE)
  @ApiOperation({ summary: "Récupérer les infos de l'entreprise" })
  getOrganisation() {
    return this.organisationService.getOrganisation();
  }

  @Post('setup')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Assistant de configuration initiale (Wizard)' })
  @ApiResponse({
    status: 201,
    description: 'Organisation configurée avec succès',
  })
  setup(@Body() dto: SetupOrganisationDto) {
    return this.organisationService.setup(dto);
  }

  @Patch()
  @Roles(...ROLES_GESTION_USERS)
  @ApiOperation({ summary: 'Mise à jour des infos (Nom, Logo...)' })
  update(@Body() dto: UpdateOrganisationDto) {
    return this.organisationService.update(dto);
  }
}
