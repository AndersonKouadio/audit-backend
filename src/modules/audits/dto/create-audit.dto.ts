import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
} from 'class-validator';
import { TypeAudit } from 'src/generated/prisma/enums';

export class CreateAuditDto {
  // La référence est désormais générée automatiquement par le service
  // (format AUD-YYYY-NNN). Champ retiré du DTO de création.

  @ApiProperty({ example: 'Audit des processus Achats' })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({ enum: TypeAudit, example: TypeAudit.INTERNE })
  @IsEnum(TypeAudit)
  type: TypeAudit;

  @ApiProperty({ example: 2026 })
  @IsInt()
  anneeFiscale: number;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  dateDebutPrevue: string;

  @ApiProperty({ example: '2026-04-15' })
  @IsDateString()
  dateFinPrevue: string;

  @ApiProperty({ description: 'ID du département audité' })
  @IsNotEmpty()
  @IsString()
  departementId: string;

  @ApiProperty({ description: 'ID du Chef de mission' })
  @IsNotEmpty()
  @IsString()
  responsableId: string;

  @ApiPropertyOptional({
    type: [String],
    description: "Tableau d'IDs des membres de l'équipe",
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipeIds?: string[];

  // --- Champs Spécifiques Audit Externe ---
  
  @ApiPropertyOptional({ example: 'KPMG', description: 'Nom du cabinet externe' })
  @IsOptional()
  @IsString()
  cabinetExterne?: string;

  @ApiPropertyOptional({ example: 'Jean Dupont', description: 'Associé signataire du cabinet' })
  @IsOptional()
  @IsString()
  associeSignataire?: string;

  @ApiPropertyOptional({ example: 'Material Weakness', description: 'Note ou évaluation' })
  @IsOptional()
  @IsString()
  noteEvaluation?: string;
}