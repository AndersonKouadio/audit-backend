import { Module } from '@nestjs/common';
import { PointsAuditService } from './points-audit.service';
import { PointsAuditController } from './points-audit.controller';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';

@Module({
  imports: [JournalAuditModule],
  controllers: [PointsAuditController],
  providers: [PointsAuditService],
})
export class PointsAuditModule {}
