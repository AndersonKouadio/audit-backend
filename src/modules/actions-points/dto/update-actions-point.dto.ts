import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { StatutActionPoint } from 'src/generated/prisma/enums';
import { CreateActionPointDto } from './create-actions-point.dto';

export class UpdateActionPointDto extends PartialType(CreateActionPointDto) {
  @ApiProperty({ example: 50, description: "Pourcentage d'avancement (0-100)" })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  avancement?: number;

  @ApiProperty({
    example: 'EN_COURS',
    enum: StatutActionPoint,
    description: 'Statut auto-calculé selon avancement (100% → TERMINE)',
  })
  @IsOptional()
  @IsEnum(StatutActionPoint)
  statut?: StatutActionPoint;
}
