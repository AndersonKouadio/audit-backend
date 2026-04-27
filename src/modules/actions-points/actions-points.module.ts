import { Module } from '@nestjs/common';
import { ActionsPointsService } from './actions-points.service';
import { ActionsPointsController } from './actions-points.controller';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JournalAuditModule, NotificationsModule],
  controllers: [ActionsPointsController],
  providers: [ActionsPointsService],
})
export class ActionsPointsModule {}
