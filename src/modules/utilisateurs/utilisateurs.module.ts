import { Module } from '@nestjs/common';
import { UtilisateursService } from './utilisateurs.service';
import { UtilisateursController } from './utilisateurs.controller';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';

@Module({
  imports: [JournalAuditModule],
  controllers: [UtilisateursController],
  providers: [UtilisateursService],
})
export class UtilisateursModule {}
