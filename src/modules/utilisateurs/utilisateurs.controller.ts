import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import {
  ROLES_AUTHENTIFIE,
  ROLES_GESTION_USERS,
  ROLES_LECTURE_USERS,
} from 'src/auth/constants/roles-matrix';
import { Utilisateur } from 'src/generated/prisma/client';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UtilisateursService } from './utilisateurs.service';

@ApiTags('Utilisateurs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('utilisateurs')
export class UtilisateursController {
  constructor(private readonly utilisateursService: UtilisateursService) {}

  @Post()
  @Roles(...ROLES_GESTION_USERS) // Seul l'admin crée les comptes
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé (Mot de passe masqué)',
  })
  create(@Body() createUtilisateurDto: CreateUtilisateurDto) {
    return this.utilisateursService.create(createUtilisateurDto);
  }

  @Patch('me')
  @Roles(...ROLES_AUTHENTIFIE) // FIX BUG : sans @Roles, le RolesGuard refusait l'accès
  @ApiOperation({ summary: 'Mettre à jour mon profil personnel' })
  updateMe(@Req() req: Request, @Body() dto: UpdateMeDto) {
    const user = req.user as Utilisateur;
    return this.utilisateursService.updateMe(user.id, dto);
  }

  @Get()
  @Roles(...ROLES_LECTURE_USERS) // ADMIN, DIRECTEUR, CHEF_DEPT_AUDIT, CHEF_MISSION (besoin d'assigner équipes)
  @ApiOperation({ summary: 'Liste paginée des utilisateurs' })
  findAll(@Query() query: UserQueryDto) {
    return this.utilisateursService.findAll(query);
  }

  @Get(':id')
  @Roles(...ROLES_LECTURE_USERS)
  @ApiOperation({ summary: "Voir le profil d'un utilisateur" })
  findOne(@Param('id') id: string) {
    return this.utilisateursService.findOne(id);
  }

  @Patch(':id')
  @Roles(...ROLES_GESTION_USERS)
  @ApiOperation({ summary: 'Modifier un utilisateur (Rôle, Dept, Statut...)' })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateUtilisateurDto: UpdateUtilisateurDto,
  ) {
    const user = req.user as Utilisateur;
    if (user.id === id) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que les profils des autres utilisateurs',
      );
    }
    return this.utilisateursService.update(id, updateUtilisateurDto);
  }

  @Delete(':id')
  @Roles(...ROLES_GESTION_USERS)
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as Utilisateur;
    if (user.id === id) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que les profils des autres utilisateurs',
      );
    }
    return this.utilisateursService.remove(id);
  }
}
