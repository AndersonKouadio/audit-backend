import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleUtilisateur, StatutUtilisateur } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'secret_fallback',
    });
  }

  async validate(payload: { sub: string; role: RoleUtilisateur }) {
    const { sub } = payload;

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: sub },
      include: { departement: true }, // On récupère le dept pour les guards futurs
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    // VÉRIFICATION DU STATUT (Ta règle métier)
    if (user.statut === StatutUtilisateur.SUSPENDU) {
      throw new UnauthorizedException(
        "Compte suspendu. Contactez l'administrateur.",
      );
    }
    if (user.statut === StatutUtilisateur.INACTIF) {
      throw new UnauthorizedException('Compte inactif.');
    }

    // On retire le mot de passe avant de le mettre dans la Request
    const result = {
      id: user.id,
      matricule: user.matricule,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      role: user.role,
      statut: user.statut,
      departementId: user.departementId,
      dateCreation: user.dateCreation,
      dateMiseAJour: user.dateMiseAJour,
      derniereConnexion: user.derniereConnexion,
    };
    return result;
  }
}
