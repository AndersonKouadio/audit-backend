import { Module } from '@nestjs/common';
import { DepartementsService } from './departements.service';
import { DepartementsController } from './departements.controller';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JournalAuditModule, NotificationsModule],
  controllers: [DepartementsController],
  providers: [DepartementsService],
})
export class DepartementsModule {}
