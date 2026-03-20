import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { TypeActionLog } from 'src/generated/prisma/enums';

export class JournalQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsString() entiteType?: string;
  @IsOptional() @IsString() entiteId?: string;
  @IsOptional() @IsString() utilisateurId?: string;
  @IsOptional() @IsEnum(TypeActionLog) action?: TypeActionLog;
  /** Début de la plage de dates (ISO 8601) */
  @IsOptional() @IsDateString() dateDebut?: string;
  /** Fin de la plage de dates (ISO 8601) */
  @IsOptional() @IsDateString() dateFin?: string;
  /** Recherche libre sur utilisateurNom ou entiteRef */
  @IsOptional() @IsString() search?: string;
}
