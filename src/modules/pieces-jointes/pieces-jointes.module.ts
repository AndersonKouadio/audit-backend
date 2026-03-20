import { Module } from '@nestjs/common';
import { PiecesJointesController } from './pieces-jointes.controller';
import { PiecesJointesService } from './pieces-jointes.service';

@Module({
  controllers: [PiecesJointesController],
  providers: [PiecesJointesService],
  exports: [PiecesJointesService],
})
export class PiecesJointesModule {}
