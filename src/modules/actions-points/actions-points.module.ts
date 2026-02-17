import { Module } from '@nestjs/common';
import { ActionsPointsService } from './actions-points.service';
import { ActionsPointsController } from './actions-points.controller';

@Module({
  controllers: [ActionsPointsController],
  providers: [ActionsPointsService],
})
export class ActionsPointsModule {}
