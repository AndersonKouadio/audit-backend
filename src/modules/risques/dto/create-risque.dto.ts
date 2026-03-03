import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CategorieRisque } from 'src/generated/prisma/enums';

export class CreateRisqueDto {
  @ApiProperty({ example: 'Risque de non-conformité réglementaire' })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({ example: 'Description détaillée du risque identifié...' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ enum: CategorieRisque })
  @IsEnum(CategorieRisque)
  categorie: CategorieRisque;

  @ApiProperty({ minimum: 1, maximum: 5, example: 3 })
  @IsInt()
  @Min(1)
  @Max(5)
  probabilite: number;

  @ApiProperty({ minimum: 1, maximum: 5, example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  impact: number;

  @ApiProperty({ description: 'ID du département concerné' })
  @IsNotEmpty()
  @IsString()
  departementId: string;

  @ApiPropertyOptional({ description: 'ID du responsable du risque' })
  @IsOptional()
  @IsString()
  responsableId?: string;

  @ApiPropertyOptional({ example: 'Contrôles existants...' })
  @IsOptional()
  @IsString()
  mesuresControle?: string;

  @ApiPropertyOptional({ example: 'Actions de traitement prévues...' })
  @IsOptional()
  @IsString()
  planTraitement?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  dateProchaineRevue?: string;
}
