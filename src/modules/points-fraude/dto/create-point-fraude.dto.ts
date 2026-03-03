import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePointFraudeDto {
  @ApiProperty({ example: 'FRM-F-001', description: 'Code unique du point de fraude' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: 'ID du cas de fraude parent' })
  @IsNotEmpty()
  @IsString()
  casId: string;

  @ApiProperty({ example: 'Absence de ségrégation des tâches' })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({ example: 'Il a été constaté que la même personne...' })
  @IsNotEmpty()
  @IsString()
  detail: string;

  @ApiProperty({ example: 'Mettre en place un contrôle à 4 yeux...' })
  @IsNotEmpty()
  @IsString()
  recommandation: string;

  @ApiPropertyOptional({ example: 5000000, description: 'Impact financier (FCFA)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coutImpact?: number;

  @ApiProperty({ description: "ID de l'auditeur FRM responsable de ce point" })
  @IsNotEmpty()
  @IsString()
  auditeurFRMId: string;

  @ApiProperty({ example: '2026-06-30', description: "Date d'échéance" })
  @IsDateString()
  dateEcheance: string;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Date de reporting spécifique FRM' })
  @IsOptional()
  @IsDateString()
  dateReporting?: string;
}
