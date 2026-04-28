import { Module } from '@nestjs/common';
import { AuditsService } from './audits.service';
import { AuditsController } from './audits.controller';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JournalAuditModule, NotificationsModule],
  controllers: [AuditsController],
  providers: [AuditsService],
})
export class AuditsModule {}
