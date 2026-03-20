import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateFormulaireRafDto {
  @ApiProperty({
    description: 'Justification de l\'acceptation du risque (min. 20 caractères)',
    minLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: 'La justification doit contenir au moins 20 caractères.' })
  justification: string;

  @ApiPropertyOptional({ description: 'Contrôle compensatoire mis en place pour atténuer le risque' })
  @IsString()
  @IsOptional()
  controleCompensatoire?: string;

  @ApiPropertyOptional({
    description: 'IDs des points d\'audit à lier à ce formulaire',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  pointAuditIds?: string[];
}
