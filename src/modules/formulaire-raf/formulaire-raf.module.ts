import { Module } from '@nestjs/common';
import { FormulaireRafController } from './formulaire-raf.controller';
import { FormulaireRafService } from './formulaire-raf.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [FormulaireRafController],
  providers: [FormulaireRafService],
  exports: [FormulaireRafService],
})
export class FormulaireRafModule {}
