import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateActionPointDto {
  @ApiProperty({ description: "ID du point d'audit rattaché" })
  @IsNotEmpty()
  @IsString()
  pointAuditId: string;

  @ApiProperty({
    example: 'Mettre en place une revue bimensuelle des accès SAP.',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: "ID de l'utilisateur responsable (Action Owner)",
  })
  @IsNotEmpty()
  @IsString()
  responsableId: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  dateEcheance: string;
}
