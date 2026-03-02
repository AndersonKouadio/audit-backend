import { PartialType } from '@nestjs/swagger';
import { CreatePointAuditDto } from './create-points-audit.dto';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { StatutPoint } from 'src/generated/prisma/enums';

export class UpdatePointsAuditDto extends PartialType(CreatePointAuditDto) {
    @IsOptional()
    @IsEnum(StatutPoint)
    statut?: StatutPoint;

    @IsOptional()
    @IsDateString()
    dateEcheanceActuelle?: string;
}
