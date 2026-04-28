import { Module } from '@nestjs/common';
import { PiecesJointesController } from './pieces-jointes.controller';
import { PiecesJointesService } from './pieces-jointes.service';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JournalAuditModule, NotificationsModule],
  controllers: [PiecesJointesController],
  providers: [PiecesJointesService],
  exports: [PiecesJointesService],
})
export class PiecesJointesModule {}
