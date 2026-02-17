import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Criticite } from 'src/generated/prisma/enums';

export class CreatePointAuditDto {
  @ApiProperty({
    example: 'AUD-2026-001',
    description: "ID de la mission d'audit",
  })
  @IsNotEmpty()
  @IsUUID()
  auditId: string;

  @ApiProperty({
    example: 'RH',
    description: 'ID du département spécifiquement concerné',
  })
  @IsNotEmpty()
  @IsString()
  departementId: string;

  @ApiProperty({
    example: "Absence de contrats signés pour 10% de l'échantillon",
  })
  @IsNotEmpty()
  @IsString()
  titre: string;

  @ApiProperty({ example: 'Lors de nos tests, nous avons constaté que...' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ example: "Risque de contentieux prud'homal" })
  @IsOptional()
  @IsString()
  consequences?: string;

  @ApiProperty({ example: 'Mettre en place une checklist de vérification...' })
  @IsNotEmpty()
  @IsString()
  recommandation: string;

  @ApiProperty({ enum: Criticite, example: Criticite.ELEVEE })
  @IsEnum(Criticite)
  criticite: Criticite;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  dateEcheanceInitiale: string;
}
