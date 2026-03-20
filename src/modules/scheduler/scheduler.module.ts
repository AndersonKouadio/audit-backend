import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { ParametresSystemeModule } from 'src/modules/parametres-systeme/parametres-systeme.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,        // Pour accéder à NotificationsService (creer, traiterFileAttente)
    ParametresSystemeModule,    // Pour lire les préférences dunning & notifications
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}
