import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { StatutUtilisateur } from 'src/generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../dto/password-reset.dto';
import { JsonWebTokenService } from './json-web-token.service';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JsonWebTokenService,
    private readonly otpService: OtpService,
  ) {}

  async login(loginDto: LoginDto) {
    // 1. Chercher l'utilisateur
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) throw new NotFoundException('Identifiants incorrects');

    // 2. Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.motDePasse,
    );
    if (!isPasswordValid)
      throw new UnauthorizedException('Identifiants incorrects');

    // 3. Vérifier le statut
    if (user.statut !== StatutUtilisateur.ACTIF) {
      throw new UnauthorizedException(
        `Votre compte est ${user.statut.toLowerCase()}`,
      );
    }

    // 4. Mettre à jour la dernière connexion
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: { derniereConnexion: new Date() },
    });

    // 5. Générer le token
    const token = await this.jwtService.generateToken(user.id, user.role);

    // 6. Vérifier l'état de l'organisation (Pour le Wizard frontend)
    // const organisation = await this.prisma.organisation.findFirst();

    // 7. Renvoyer le tout
    const userData = {
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
    return {
      user: userData,
      token,
      tokenExpires: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      // setupRequired: !organisation?.estConfiguree,
      // organisationName: organisation?.nom,
    };
  }

  logout(userId: string) {
    // Stateless JWT : On ne fait rien côté serveur,
    // ou on pourrait ajouter le token à une blacklist Redis.
    return { message: 'Déconnexion réussie', userId };
  }

  // 1. DEMANDE DE RÉINITIALISATION
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Sécurité : On ne dit pas si l'email existe ou non pour éviter le "User Enumeration"
      // Mais on retourne toujours un message de succès.
      return {
        message: 'Si cet email existe, un code de vérification a été envoyé.',
      };
    }

    // Génération du code via ton OtpService
    const otp = await this.otpService.generate(user.email);

    // ---------------------------------------------------------
    // TODO: Remplacer ceci par ton vrai service d'email plus tard
    // ---------------------------------------------------------
    this.logger.log(`📧 [MOCK EMAIL] À: ${user.email} | Code OTP: ${otp}`);
    this.logger.warn(`👉 COPIE CE CODE POUR TESTER DANS SWAGGER : ${otp}`);
    // ---------------------------------------------------------

    return {
      message: 'Si cet email existe, un code de vérification a été envoyé.',
    };
  }

  // 2. VALIDATION ET CHANGEMENT DE MOT DE PASSE
  async resetPassword(dto: ResetPasswordDto) {
    // A. Vérifier le code OTP
    const isOtpValid = await this.otpService.verify(dto.email, dto.otp);

    if (!isOtpValid) {
      throw new UnauthorizedException('Code OTP invalide ou expiré.');
    }

    // B. Récupérer l'utilisateur
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: dto.email },
    });

    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    // C. Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(dto.newPassword, salt);

    // D. Mettre à jour en base
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: {
        motDePasse: hash,
        dateMiseAJour: new Date(),
      },
    });

    // E. (Optionnel) Invalider tous les refresh tokens existants ici si tu veux une sécu max

    return {
      message:
        'Votre mot de passe a été modifié avec succès. Vous pouvez vous connecter.',
    };
  }
}
