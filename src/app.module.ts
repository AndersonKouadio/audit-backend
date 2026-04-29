import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
  providers: [],
})
export class AppModule {}
