import { Module } from '@nestjs/common';
import { ParametresSystemeController } from './parametres-systeme.controller';
import { ParametresSystemeService } from './parametres-systeme.service';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';

@Module({
  imports: [JournalAuditModule],
  controllers: [ParametresSystemeController],
  providers: [ParametresSystemeService],
  exports: [ParametresSystemeService],
})
export class ParametresSystemeModule {}
