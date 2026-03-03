import { Module } from '@nestjs/common';
import { JournalAuditModule } from 'src/modules/journal-audit/journal-audit.module';
import { RisquesController } from './risques.controller';
import { RisquesService } from './risques.service';

@Module({
  imports: [JournalAuditModule],
  controllers: [RisquesController],
  providers: [RisquesService],
  exports: [RisquesService],
})
export class RisquesModule {}
