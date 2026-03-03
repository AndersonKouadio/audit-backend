import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommentaireDto {
  @ApiProperty({ example: 'POINT_AUDIT', description: "Type de l'entité (POINT_AUDIT, POINT_FRAUDE)" })
  @IsNotEmpty()
  @IsString()
  typeEntite: string;

  @ApiProperty({ description: "ID de l'entité commentée" })
  @IsNotEmpty()
  @IsString()
  entiteId: string;

  @ApiProperty({ example: 'Le document justificatif a été transmis par email.' })
  @IsNotEmpty()
  @IsString()
  texte: string;

  @ApiPropertyOptional({ default: false, description: 'Commentaire interne visible uniquement par les auditeurs' })
  @IsOptional()
  @IsBoolean()
  estInterne?: boolean;
}
