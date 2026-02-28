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
