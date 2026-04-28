import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './services/auth.service';
import { AuthController } from './auth.controller';
import { JsonWebTokenService } from './services/json-web-token.service';
import { OtpService } from './services/otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JournalAuditModule } from 'src/modules/journal-audit/journal-audit.module';
import ms from 'ms';
import type { StringValue } from 'ms';

@Module({
  imports: [
    PassportModule,
    JournalAuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: ms(
            configService.get<StringValue>('JWT_EXPIRATION') || '30d',
          ),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JsonWebTokenService, OtpService, JwtStrategy],
  exports: [JsonWebTokenService, AuthService, OtpService],
})
export class AuthModule {}
