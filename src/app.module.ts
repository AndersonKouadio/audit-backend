import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrganisationModule } from './modules/organisation/organisation.module';
import { DepartementsModule } from './modules/departements/departements.module';
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module';
import { AuditsModule } from './modules/audits/audits.module';
import { PointsAuditModule } from './modules/points-audit/points-audit.module';
import { ActionsPointsModule } from './modules/actions-points/actions-points.module';

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
    AuditsModule,
    PointsAuditModule,
    ActionsPointsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
