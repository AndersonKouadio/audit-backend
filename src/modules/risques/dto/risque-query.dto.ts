import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CategorieRisque, StatutRisque } from 'src/generated/prisma/enums';

export class RisqueQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 10;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(StatutRisque) statut?: StatutRisque;
  @IsOptional() @IsEnum(CategorieRisque) categorie?: CategorieRisque;
  @IsOptional() @IsString() departementId?: string;
}
