import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

/**
 * Module Email — Global pour être injectable partout sans réimporter.
 *
 * Prérequis : npm install nodemailer && npm install -D @types/nodemailer
 *
 * Variables d'environnement requises (.env) :
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=noreply@example.com
 *   SMTP_PASS=your_password
 *   SMTP_FROM="Audit Interne <noreply@audit.ci>"
 */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
