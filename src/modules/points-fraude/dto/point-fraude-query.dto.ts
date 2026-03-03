import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PointFraudeQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 10;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsString() casId?: string;
  @IsOptional() @IsString() auditeurFRMId?: string;
}
