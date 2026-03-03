import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreatePointFraudeDto } from './create-point-fraude.dto';

export class UpdatePointFraudeDto extends PartialType(CreatePointFraudeDto) {
  @IsOptional()
  @IsString()
  statut?: string;

  @IsOptional()
  @IsString()
  commentaire?: string; // Justification lors du changement de statut
}
