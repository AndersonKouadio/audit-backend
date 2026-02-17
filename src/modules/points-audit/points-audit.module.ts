import { Module } from '@nestjs/common';
import { PointsAuditService } from './points-audit.service';
import { PointsAuditController } from './points-audit.controller';

@Module({
  controllers: [PointsAuditController],
  providers: [PointsAuditService],
})
export class PointsAuditModule {}
