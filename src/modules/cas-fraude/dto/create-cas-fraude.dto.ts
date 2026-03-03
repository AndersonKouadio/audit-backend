import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCasFraudeDto {
  @ApiProperty({ example: 'FRM-2026-001', description: 'Numéro unique du cas de fraude' })
  @IsNotEmpty()
  @IsString()
  numeroCas: string;

  @ApiProperty({ example: 'Détournement de fonds - Direction Finances' })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({ example: 'Un employé a effectué des virements non autorisés...' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'ID du département concerné' })
  @IsNotEmpty()
  @IsString()
  departementId: string;

  @ApiProperty({ example: '2026-03-01', description: 'Date de signalement du cas' })
  @IsDateString()
  dateSignalement: string;

  @ApiPropertyOptional({ example: 15000000, description: 'Impact financier estimé (FCFA)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  coutImpact?: number;

  @ApiProperty({ description: "ID de l'auditeur FRM responsable" })
  @IsNotEmpty()
  @IsString()
  auditeurFRMId: string;
}
