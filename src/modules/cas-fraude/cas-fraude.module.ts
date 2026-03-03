import { Module } from '@nestjs/common';
import { CasFraudeController } from './cas-fraude.controller';
import { CasFraudeService } from './cas-fraude.service';

@Module({
  controllers: [CasFraudeController],
  providers: [CasFraudeService],
  exports: [CasFraudeService],
})
export class CasFraudeModule {}
