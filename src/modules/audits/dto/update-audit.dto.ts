import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StatutAudit } from 'src/generated/prisma/enums';
import { CreateAuditDto } from './create-audit.dto';

export class UpdateAuditDto extends PartialType(CreateAuditDto) {
  @ApiPropertyOptional({
    enum: StatutAudit,
    description: 'Statut de la mission (transition de cycle de vie)',
  })
  @IsOptional()
  @IsEnum(StatutAudit)
  statut?: StatutAudit;
}
