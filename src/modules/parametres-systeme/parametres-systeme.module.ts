import { Module } from '@nestjs/common';
import { ParametresSystemeController } from './parametres-systeme.controller';
import { ParametresSystemeService } from './parametres-systeme.service';

@Module({
  controllers: [ParametresSystemeController],
  providers: [ParametresSystemeService],
  exports: [ParametresSystemeService],
})
export class ParametresSystemeModule {}
