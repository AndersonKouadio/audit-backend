import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateDepartementInitialDto {
  @ApiProperty({ example: 'FIN', description: 'Code unique du département' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ example: 'Direction Financière' })
  @IsNotEmpty()
  @IsString()
  nom: string;
}

export class SetupOrganisationDto {
  @ApiProperty({ example: 'Sentinel Corp' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  @ApiProperty({ example: 'CI-ABJ-2026-B-123' })
  @IsOptional()
  @IsString()
  matricule?: string;

  @ApiProperty({ example: 'Abidjan, Cocody' })
  @IsOptional()
  @IsString()
  adresse?: string;

  @ApiProperty({ example: 'https://sentinel.com', required: false })
  @IsOptional()
  @IsString()
  siteWeb?: string;

  @ApiProperty({ example: '/uploads/logo-xxx.png', required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  // Permet de créer les départements de base (Audit, IT, RH...) lors du setup
  @ApiProperty({ type: [CreateDepartementInitialDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDepartementInitialDto)
  departements?: CreateDepartementInitialDto[];
}
