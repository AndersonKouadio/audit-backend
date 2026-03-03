import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TypeActionLog } from 'src/generated/prisma/enums';

export class JournalQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsString() entiteType?: string;
  @IsOptional() @IsString() entiteId?: string;
  @IsOptional() @IsString() utilisateurId?: string;
  @IsOptional() @IsEnum(TypeActionLog) action?: TypeActionLog;
}
