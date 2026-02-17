import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateActionPointDto {
  @ApiProperty({ description: "ID du point d'audit rattaché" })
  @IsNotEmpty()
  @IsUUID()
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
  @IsUUID()
  responsableId: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  dateEcheance: string;
}
