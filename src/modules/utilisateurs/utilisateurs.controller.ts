import {
  Body,
  Controller,
  Delete,
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
import { Utilisateur } from 'src/generated/prisma/client';
import { RoleUtilisateur } from 'src/generated/prisma/enums';
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
  @Roles(RoleUtilisateur.ADMIN) // Seul l'admin crée les comptes
  @ApiOperation({ summary: 'Créer un nouvel utilisateur' })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé (Mot de passe masqué)',
  })
  create(@Body() createUtilisateurDto: CreateUtilisateurDto) {
    return this.utilisateursService.create(createUtilisateurDto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Mettre à jour mon profil personnel' })
  updateMe(@Req() req: Request, @Body() dto: UpdateMeDto) {
    const user = req.user as Utilisateur;
    return this.utilisateursService.updateMe(user.id, dto);
  }

  @Get()
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT)
  @ApiOperation({ summary: 'Liste paginée des utilisateurs' })
  findAll(@Query() query: UserQueryDto) {
    return this.utilisateursService.findAll(query);
  }

  @Get(':id')
  @Roles(RoleUtilisateur.ADMIN, RoleUtilisateur.DIRECTEUR_AUDIT)
  @ApiOperation({ summary: "Voir le profil d'un utilisateur" })
  findOne(@Param('id') id: string) {
    return this.utilisateursService.findOne(id);
  }

  @Patch(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Modifier un utilisateur (Rôle, Dept, Statut...)' })
  update(
    @Param('id') id: string,
    @Body() updateUtilisateurDto: UpdateUtilisateurDto,
  ) {
    return this.utilisateursService.update(id, updateUtilisateurDto);
  }

  @Delete(':id')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  remove(@Param('id') id: string) {
    return this.utilisateursService.remove(id);
  }
}
