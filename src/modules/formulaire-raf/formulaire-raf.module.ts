import { Module } from '@nestjs/common';
import { FormulaireRafController } from './formulaire-raf.controller';
import { FormulaireRafService } from './formulaire-raf.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';

@Module({
  imports: [NotificationsModule, JournalAuditModule],
  controllers: [FormulaireRafController],
  providers: [FormulaireRafService],
  exports: [FormulaireRafService],
})
export class FormulaireRafModule {}
