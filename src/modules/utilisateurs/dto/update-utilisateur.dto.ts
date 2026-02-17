import { PartialType, PickType } from '@nestjs/swagger';
import { CreateUtilisateurDto } from './create-utilisateur.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StatutUtilisateur } from 'src/generated/prisma/enums';

export class UpdateUtilisateurDto extends PartialType(
  PickType(CreateUtilisateurDto, [
    'role',
    'departementId',
    'matricule',
    'motDePasse',
  ]),
) {
  @ApiProperty({ enum: StatutUtilisateur, required: false })
  @IsOptional()
  @IsEnum(StatutUtilisateur)
  statut?: StatutUtilisateur;
}
