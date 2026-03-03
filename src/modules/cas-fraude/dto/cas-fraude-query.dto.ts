import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { StatutCasFraude } from 'src/generated/prisma/enums';

export class CasFraudeQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 10;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(StatutCasFraude) statut?: StatutCasFraude;
  @IsOptional() @IsString() departementId?: string;
  @IsOptional() @IsString() auditeurFRMId?: string;
}
