import { Module } from '@nestjs/common';
import { PointsFraudeController } from './points-fraude.controller';
import { PointsFraudeService } from './points-fraude.service';

@Module({
  controllers: [PointsFraudeController],
  providers: [PointsFraudeService],
  exports: [PointsFraudeService],
})
export class PointsFraudeModule {}
