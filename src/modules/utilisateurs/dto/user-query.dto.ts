import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UserQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 10;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() departementId?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() statut?: string;
}
