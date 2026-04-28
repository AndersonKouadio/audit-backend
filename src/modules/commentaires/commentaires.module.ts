import { Module } from '@nestjs/common';
import { CommentairesController } from './commentaires.controller';
import { CommentairesService } from './commentaires.service';
import { JournalAuditModule } from '../journal-audit/journal-audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JournalAuditModule, NotificationsModule],
  controllers: [CommentairesController],
  providers: [CommentairesService],
  exports: [CommentairesService],
})
export class CommentairesModule {}
