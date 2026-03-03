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
import { CasFraudeModule } from 'src/modules/cas-fraude/cas-fraude.module';
import { PointsFraudeModule } from 'src/modules/points-fraude/points-fraude.module';
import { CommentairesModule } from 'src/modules/commentaires/commentaires.module';
import { JournalAuditModule } from 'src/modules/journal-audit/journal-audit.module';
import { DashboardModule } from 'src/modules/dashboard/dashboard.module';
import { SchedulerModule } from 'src/modules/scheduler/scheduler.module';
import { ExportModule } from 'src/modules/export/export.module';
import { RisquesModule } from 'src/modules/risques/risques.module';

@Module({
  imports: [
    // 1. Configuration globale (lit le fichier .env)
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Socle technique (Base de données)
    PrismaModule,

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

    // 6. Modules Métiers - FRM (Fraud Risk Management)
    CasFraudeModule,
    PointsFraudeModule,

    // 6b. Modules Métiers - Risk Management
    RisquesModule,

    // 7. Modules Transverses
    CommentairesModule,
    JournalAuditModule,

    // 8. Dashboard & Analytics
    DashboardModule,

    // 9. Automatisation (Cron Jobs)
    SchedulerModule,

    // 10. Export
    ExportModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
