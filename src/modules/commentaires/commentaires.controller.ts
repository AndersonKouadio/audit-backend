import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { CommentairesService } from './commentaires.service';
import { CreateCommentaireDto } from './dto/create-commentaire.dto';

@ApiTags('Commentaires')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commentaires')
export class CommentairesController {
  constructor(private readonly commentairesService: CommentairesService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur un point (audit ou fraude)' })
  create(@Req() req, @Body() dto: CreateCommentaireDto) {
    return this.commentairesService.create(req.user.id, dto);
  }

  @Get(':typeEntite/:entiteId')
  @ApiOperation({ summary: "Lister tous les commentaires d'une entité" })
  findByEntite(
    @Param('typeEntite') typeEntite: string,
    @Param('entiteId') entiteId: string,
  ) {
    return this.commentairesService.findByEntite(typeEntite, entiteId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  remove(@Param('id') id: string) {
    return this.commentairesService.remove(id);
  }
}
