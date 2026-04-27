import {
  ForbiddenException,
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

// Compteur en mémoire des tentatives échouées par email (lockout léger)
// Reset au redémarrage. Pour persistant, utiliser Redis.
interface AttemptRecord {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}
const failedAttempts = new Map<string, AttemptRecord>();
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60_000; // 15 minutes
const LOCKOUT_MS = 30 * 60_000; // 30 minutes lockout

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JsonWebTokenService,
    private readonly otpService: OtpService,
  ) {}

  private checkLockout(email: string) {
    const rec = failedAttempts.get(email);
    if (!rec) return;
    if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
      const minutes = Math.ceil((rec.lockedUntil - Date.now()) / 60_000);
      throw new ForbiddenException(
        `Compte temporairement verrouillé suite à ${MAX_ATTEMPTS} tentatives. Réessayez dans ${minutes} minute(s).`,
      );
    }
    if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
      // Lockout expiré → reset
      failedAttempts.delete(email);
    }
  }

  private recordFailedAttempt(email: string) {
    const now = Date.now();
    const rec = failedAttempts.get(email);
    if (!rec || now - rec.firstAt > ATTEMPT_WINDOW_MS) {
      failedAttempts.set(email, { count: 1, firstAt: now });
      return;
    }
    rec.count += 1;
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = now + LOCKOUT_MS;
      this.logger.warn(
        `🔒 Compte ${email} verrouillé pour ${LOCKOUT_MS / 60_000} min après ${MAX_ATTEMPTS} échecs.`,
      );
    }
  }

  private clearFailedAttempts(email: string) {
    failedAttempts.delete(email);
  }

  async login(loginDto: LoginDto) {
    // 0. Vérifier si le compte est verrouillé (lockout)
    this.checkLockout(loginDto.email);

    // 1. Chercher l'utilisateur
    const user = await this.prisma.utilisateur.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      this.recordFailedAttempt(loginDto.email);
      throw new NotFoundException('Identifiants incorrects');
    }

    // 2. Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.motDePasse,
    );
    if (!isPasswordValid) {
      this.recordFailedAttempt(loginDto.email);
      throw new UnauthorizedException('Identifiants incorrects');
    }

    // 3. Vérifier le statut
    if (user.statut !== StatutUtilisateur.ACTIF) {
      throw new UnauthorizedException(
        `Votre compte est ${user.statut.toLowerCase()}`,
      );
    }

    // Login réussi → reset compteur tentatives
    this.clearFailedAttempts(loginDto.email);

    // 4. Mettre à jour la dernière connexion
    await this.prisma.utilisateur.update({
      where: { id: user.id },
      data: { derniereConnexion: new Date() },
    });

    // 5. Générer le token
    const token = await this.jwtService.generateToken(user.id, user.role);

    // 6. Vérifier l'état de l'organisation (Pour le Wizard frontend)
    const organisation = await this.prisma.organisation.findFirst();

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
      setupRequired: !organisation?.estConfiguree,
      organisationName: organisation?.nom,
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
