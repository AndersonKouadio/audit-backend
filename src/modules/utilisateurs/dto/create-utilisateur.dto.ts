import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

export class CreateUtilisateurDto {
  @ApiProperty({ example: 'jean.kouassi@sentinel.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jean' })
  @IsNotEmpty()
  @IsString()
  prenom: string;

  @ApiProperty({ example: 'Kouassi' })
  @IsNotEmpty()
  @IsString()
  nom: string;

  // On force un mot de passe initial
  @ApiProperty({ example: 'Password123!' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  motDePasse: string;

  @ApiProperty({
    enum: RoleUtilisateur,
    example: RoleUtilisateur.AUDITEUR_SENIOR,
  })
  @IsNotEmpty()
  @IsEnum(RoleUtilisateur)
  role: RoleUtilisateur;

  @ApiProperty({
    example: 'uuid-du-departement',
    description: "ID du département d'appartenance",
  })
  @IsOptional()
  @IsString()
  departementId?: string;

  @ApiProperty({ example: 'M-2026-001' })
  @IsOptional()
  @IsString()
  matricule?: string;
}
