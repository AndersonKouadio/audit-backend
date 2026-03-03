import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StatutCasFraude } from 'src/generated/prisma/enums';
import { CreateCasFraudeDto } from './create-cas-fraude.dto';

export class UpdateCasFraudeDto extends PartialType(CreateCasFraudeDto) {
  @IsOptional()
  @IsEnum(StatutCasFraude)
  statut?: StatutCasFraude;
}
