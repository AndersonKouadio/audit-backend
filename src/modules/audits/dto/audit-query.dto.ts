import { IsOptional, IsString, IsInt, IsEnum, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { TypeAudit, StatutAudit } from 'src/generated/prisma/enums';

export class AuditQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 10;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(TypeAudit) type?: TypeAudit;
  @IsOptional() @IsEnum(StatutAudit) statut?: StatutAudit;
  @IsOptional() @IsInt() @Type(() => Number) annee?: number;
  @IsOptional() @IsString() departementId?: string;
  /** Pour les rôles BU : exclut les missions CLOTURE et ARCHIVE */
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === 'true' || value === true) actif?: boolean;
}
