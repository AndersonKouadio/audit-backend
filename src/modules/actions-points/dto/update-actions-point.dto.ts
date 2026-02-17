import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
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
    enum: ['A_FAIRE', 'EN_COURS', 'TERMINE'],
  })
  @IsOptional()
  @IsString()
  statut?: string;
}
