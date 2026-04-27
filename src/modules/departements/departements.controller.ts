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
import { ROLES_LECTURE_GLOBALE } from 'src/auth/constants/roles-matrix';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
import { DepartementsService } from './departements.service';
import { CreateDepartementDto } from './dto/create-departement.dto';
import { UpdateDepartementDto } from './dto/update-departement.dto';
import { DeptQueryDto } from './dto/dept-query.dto';

@ApiTags('Départements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departements')
export class DepartementsController {
  constructor(private readonly departementsService: DepartementsService) {}

  @Post()
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  )
  @ApiOperation({ summary: 'Créer un nouveau département' })
  create(@Body() createDepartementDto: CreateDepartementDto) {
    return this.departementsService.create(createDepartementDto);
  }

  @Get('liste')
  @Roles(...ROLES_LECTURE_GLOBALE)
  @ApiOperation({ summary: 'Liste paginée des départements (pour tableaux)' })
  findAllPaginated(@Query() query: DeptQueryDto) {
    return this.departementsService.findAllPaginated(query);
  }

  @Get('arbre')
  @Roles(...ROLES_LECTURE_GLOBALE)
  @ApiOperation({ summary: 'Organigramme complet (vue hiérarchique)' })
  findTree() {
    return this.departementsService.findAllTree();
  }

  @Get(':id')
  @Roles(...ROLES_LECTURE_GLOBALE)
  @ApiOperation({ summary: "Détails d'un département" })
  findOne(@Param('id') id: string) {
    return this.departementsService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    RoleUtilisateur.ADMIN,
    RoleUtilisateur.DIRECTEUR_AUDIT,
    RoleUtilisateur.CHEF_DEPARTEMENT_AUDIT,
  )
  @ApiOperation({ summary: 'Modifier un département' })
  update(
    @Param('id') id: string,
    @Body() updateDepartementDto: UpdateDepartementDto,
  ) {
    return this.departementsService.update(id, updateDepartementDto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT)
  @ApiOperation({ summary: 'Supprimer un département' })
  remove(@Param('id') id: string) {
    return this.departementsService.remove(id);
  }
}
