import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from 'ms';
import { generate as generateOtp } from 'otplib';

import type { StringValue } from 'ms';

import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class OtpService {
  private readonly otpExpiration: number;
  private readonly otpSecret: string;
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const expirationConfig =
      this.configService.get<StringValue>('OTP_EXPIRATION') ?? '5m';

    // Conversion sécurisée
    this.otpExpiration =
      typeof expirationConfig === 'string'
        ? ms(expirationConfig)
        : expirationConfig;

    // Récupération du secret global pour la génération HOTP
    this.otpSecret = this.configService.get<string>('OTP_SECRET') as string;

    if (!this.otpSecret) {
      throw new InternalServerErrorException(
        "OTP_SECRET n'est pas défini dans le .env",
      );
    }
  }

  async generate(email: string): Promise<string> {
    // 1. GESTION DU COMPTEUR (Incrémentation)
    let counter = 1;
    const counterOtp = await this.prisma.counterOtp.findFirst();

    if (counterOtp) {
      counter = counterOtp.counter + 1;
      // Mise à jour du compteur global
      await this.prisma.counterOtp.update({
        where: { id: counterOtp.id },
        data: { counter },
      });
    } else {
      // Initialisation si la table est vide
      await this.prisma.counterOtp.create({ data: { counter } });
    }

    // 2. GÉNÉRATION DU CODE VIA HOTP (Secret + Compteur)
    const code = await generateOtp({
      secret: this.otpSecret,
      counter: counterOtp?.counter,
      digits: 6,
      algorithm: 'sha1',
    });

    // 3. NETTOYAGE (On supprime les vieux codes de cet utilisateur)
    await this.prisma.otpToken.deleteMany({
      where: { email },
    });

    // 4. STOCKAGE DU CODE
    await this.prisma.otpToken.create({
      data: {
        code,
        email,
        counter,
        expire: new Date(Date.now() + this.otpExpiration),
      },
    });

    return code;
  }

  async verify(email: string, code: string): Promise<boolean> {
    // 1. RECHERCHE EXACTE (Email + Code)
    const record = await this.prisma.otpToken.findFirst({
      where: {
        email,
        code,
      },
    });

    if (!record) return false;

    // 2. VÉRIFICATION DE L'EXPIRATION
    if (record.expire < new Date()) {
      // Nettoyage
      await this.prisma.otpToken.delete({ where: { id: record.id } });
      return false;
    }

    // 3. SUPPRESSION APRÈS USAGE (Anti-Replay)
    await this.prisma.otpToken.delete({
      where: { id: record.id },
    });

    return true;
  }
}
