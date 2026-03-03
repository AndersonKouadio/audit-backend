import { Module } from '@nestjs/common';
import { CommentairesController } from './commentaires.controller';
import { CommentairesService } from './commentaires.service';

@Module({
  controllers: [CommentairesController],
  providers: [CommentairesService],
  exports: [CommentairesService],
})
export class CommentairesModule {}
