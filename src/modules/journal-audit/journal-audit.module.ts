import { Module } from '@nestjs/common';
import { JournalAuditController } from './journal-audit.controller';
import { JournalAuditService } from './journal-audit.service';

@Module({
  controllers: [JournalAuditController],
  providers: [JournalAuditService],
  exports: [JournalAuditService],
})
export class JournalAuditModule {}
