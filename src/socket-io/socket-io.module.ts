import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppGateway } from './gateways/app.gateway';

/**
 * Module Socket.io global. Importé une seule fois dans AppModule, exposé partout
 * via `@Global()` — n'importe quel service peut injecter AppGateway.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AppGateway],
  exports: [AppGateway],
})
export class SocketIoModule {}
