import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StatutRisque } from 'src/generated/prisma/enums';
import { CreateRisqueDto } from './create-risque.dto';

export class UpdateRisqueDto extends PartialType(CreateRisqueDto) {
  @IsOptional()
  @IsEnum(StatutRisque)
  statut?: StatutRisque;
}
