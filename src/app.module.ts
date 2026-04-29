import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from 'src/auth/auth.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { OrganisationModule } from 'src/modules/organisation/organisation.module';
import { DepartementsModule } from 'src/modules/departements/departements.module';
import { UtilisateursModule } from 'src/modules/utilisateurs/utilisateurs.module';
import { AuditsModule } from 'src/modules/audits/audits.module';
import { PointsAuditModule } from 'src/modules/points-audit/points-audit.module';
import { ActionsPointsModule } from 'src/modules/actions-points/actions-points.module';
import { CommentairesModule } from 'src/modules/commentaires/commentaires.module';
import { JournalAuditModule } from 'src/modules/journal-audit/journal-audit.module';
import { DashboardModule } from 'src/modules/dashboard/dashboard.module';
import { SchedulerModule } from 'src/modules/scheduler/scheduler.module';
import { ExportModule } from 'src/modules/export/export.module';
import { EmailModule } from 'src/modules/mailer/email.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { PiecesJointesModule } from 'src/modules/pieces-jointes/pieces-jointes.module';
import { FormulaireRafModule } from 'src/modules/formulaire-raf/formulaire-raf.module';
import { ParametresSystemeModule } from 'src/modules/parametres-systeme/parametres-systeme.module';
import { SocketIoModule } from 'src/socket-io/socket-io.module';

@Module({
  imports: [
    // 1. Configuration globale (lit le fichier .env)
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 1.bis. Rate limiting global (anti brute-force)
    // 1000 requêtes / minute par IP : suffisant pour une SPA qui charge plusieurs
    // queries en parallèle (dashboard, points-audit, reporting) tout en bloquant
    // les bots/scrapers. Le throttler stricte reste sur /auth/login (10/15 min).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000, // 1 minute
        limit: 1000,
      },
      {
        name: 'auth',
        ttl: 15 * 60_000, // 15 minutes
        limit: 10, // 10 tentatives login / 15 min / IP
      },
    ]),

    // 2. Socle technique (Base de données)
    PrismaModule,

    // 2.bis. WebSocket Gateway global (temps réel)
    SocketIoModule,

    // 3. Modules de Sécurité
    AuthModule,

    // 4. Modules Métiers - Administration & Structure
    OrganisationModule,
    DepartementsModule,
    UtilisateursModule,

    // 5. Modules Métiers - Audit Interne & Externe
    AuditsModule,
    PointsAuditModule,
    ActionsPointsModule,

    // 6. Modules Transverses
    CommentairesModule,
    JournalAuditModule,
    EmailModule,          // Global — Email SMTP (nodemailer)
    NotificationsModule,  // Centre de notifications in-app + queue email

    PiecesJointesModule,       // Upload de fichiers (PDF, images, Excel, etc.)
    FormulaireRafModule,       // Formulaires d'Acceptation du Risque (RAF)
    ParametresSystemeModule,   // Configuration système (singleton)

    // 7. Dashboard & Analytics
    DashboardModule,

    // 8. Automatisation (Cron Jobs)
    SchedulerModule,

    // 9. Export
    ExportModule,
  ],
  controllers: [],
  providers: [
    // Rate limiting global appliqué à toutes les routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
