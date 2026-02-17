import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { RoleUtilisateur } from 'src/generated/prisma/enums';

@Injectable()
export class JsonWebTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateToken(userId: string, role: RoleUtilisateur) {
    const secret = this.configService.get<string>('JWT_SECRET', '');
    const expiresIn =
      this.configService.get<StringValue>('JWT_EXPIRATION') || '30d';
    const token = await this.jwtService.signAsync(
      { sub: userId, role },
      { secret, expiresIn },
    );
    return token;
  }
}
