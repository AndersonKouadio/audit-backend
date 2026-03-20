import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export type NiveauApprobation = 'HOD' | 'GM' | 'CEO' | 'COMITE';

export class ApprouverRafDto {
  @ApiProperty({
    description: 'Nom complet de l\'approbateur',
    example: 'Jean Dupont',
  })
  @IsString()
  @IsNotEmpty()
  nom: string;

  @ApiProperty({
    description: 'Niveau d\'approbation dans la chaîne de validation',
    enum: ['HOD', 'GM', 'CEO', 'COMITE'],
    example: 'HOD',
  })
  @IsIn(['HOD', 'GM', 'CEO', 'COMITE'], {
    message: 'Niveau d\'approbation invalide. Valeurs acceptées : HOD, GM, CEO, COMITE.',
  })
  niveau: NiveauApprobation;
}
