import { PartialType } from '@nestjs/swagger';
import { CreatePointAuditDto } from './create-points-audit.dto';
import { IsOptional, IsEnum, IsDateString, IsString, ValidateIf } from 'class-validator';
import { StatutPoint } from 'src/generated/prisma/enums';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePointsAuditDto extends PartialType(CreatePointAuditDto) {
  @ApiProperty({ enum: StatutPoint, required: false, description: "Statut officiel Audit (réservé à l'équipe Audit)" })
  @IsOptional()
  @IsEnum(StatutPoint)
  statut?: StatutPoint;

  @ApiProperty({ required: false, description: "Statut déclaré par la BU (Risk Champion / Action Owner)" })
  @IsOptional()
  @IsEnum(StatutPoint)
  statutBu?: StatutPoint;

  @ApiProperty({ required: false, description: "Justification obligatoire lors du changement de statut par la BU" })
  @ValidateIf((o) => o.statutBu !== undefined)
  @IsString()
  commentaireStatutBu?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateEcheanceActuelle?: string;

  @ApiProperty({ required: false, description: "Nom du Manager Audit qui valide la clôture" })
  @IsOptional()
  @IsString()
  revidePar?: string;

  @ApiProperty({ required: false, description: "Date de revue de clôture par le Manager" })
  @IsOptional()
  @IsDateString()
  revueLe?: string;
}
