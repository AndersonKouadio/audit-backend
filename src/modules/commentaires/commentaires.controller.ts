import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import {
  ROLES_AUTHENTIFIE,
  ROLES_LECTURE_GLOBALE,
} from 'src/auth/constants/roles-matrix';
import { CommentairesService } from './commentaires.service';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';

@ApiTags('Commentaires')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commentaires')
export class CommentairesController {
  constructor(private readonly commentairesService: CommentairesService) {}

  @Post()
  @Roles(...ROLES_AUTHENTIFIE) // tout user authentifié peut commenter
  @ApiOperation({ summary: 'Ajouter un commentaire sur un point (audit ou fraude)' })
  create(@Req() req, @Body() dto: CreateCommentaireDto) {
    return this.commentairesService.create(req.user.id, dto, req.user);
  }

  @Get(':typeEntite/:entiteId')
  @Roles(...ROLES_LECTURE_GLOBALE) // les commentaires internes sont filtrés dans le service
  @ApiOperation({ summary: "Lister tous les commentaires d'une entité" })
  findByEntite(
    @Req() req,
    @Param('typeEntite') typeEntite: string,
    @Param('entiteId') entiteId: string,
  ) {
    return this.commentairesService.findByEntite(typeEntite, entiteId, req.user);
  }

  @Delete(':id')
  @Roles(...ROLES_AUTHENTIFIE) // l'auteur ou un admin peut supprimer (vérifié dans le service)
  @ApiOperation({ summary: 'Supprimer un commentaire (auteur ou admin uniquement)' })
  remove(@Req() req, @Param('id') id: string) {
    return this.commentairesService.remove(id, req.user);
  }
}
