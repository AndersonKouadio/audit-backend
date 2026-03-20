import { IsOptional, IsString, IsInt, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Criticite, StatutPoint } from 'src/generated/prisma/enums';
import { ApiProperty } from '@nestjs/swagger';

export class PointQueryDto {
  @IsOptional() @IsInt() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Type(() => Number) limit?: number = 10;

  @IsOptional() @IsString() search?: string;

  @ApiProperty({ enum: Criticite, required: false })
  @IsOptional() @IsEnum(Criticite) criticite?: Criticite;

  @ApiProperty({ enum: StatutPoint, required: false, description: 'Filtre sur le statut officiel Audit' })
  @IsOptional() @IsEnum(StatutPoint) statut?: StatutPoint;

  @ApiProperty({ enum: StatutPoint, required: false, description: 'Filtre sur le statut déclaré par la BU' })
  @IsOptional() @IsEnum(StatutPoint) statutBu?: StatutPoint;

  @IsOptional() @IsString() auditId?: string;
  @IsOptional() @IsString() departementId?: string;
  @IsOptional() @IsString() createurId?: string;
}
