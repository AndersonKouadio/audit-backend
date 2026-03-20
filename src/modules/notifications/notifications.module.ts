import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ParametresSystemeModule } from 'src/modules/parametres-systeme/parametres-systeme.module';

@Module({
  imports: [ParametresSystemeModule], // Pour lire emailNotificationsActives avant envoi email
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
