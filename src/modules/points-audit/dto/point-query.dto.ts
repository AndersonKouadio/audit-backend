import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Criticite, StatutPoint } from 'src/generated/prisma/enums';

export class PointQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 10;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(Criticite) criticite?: Criticite;
  @IsOptional() @IsEnum(StatutPoint) statut?: StatutPoint;
  @IsOptional() @IsString() auditId?: string;
  @IsOptional() @IsString() departementId?: string;
}
