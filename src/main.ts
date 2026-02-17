import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
// import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Vérification de la production
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      timestamp: true,
      logLevels: isProduction
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'debug', 'verbose', 'log'],
      json: isProduction,
      prefix: 'audit_backend',
      colors: !isProduction,
    }),
  });

  // 🔹 Indique à Express de faire confiance à Nginx pour les headers IP
  app.set('trust proxy', true);

  // injecter globalement ValidationPipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Appliquer le filtre globalement à toute l'application
  // app.useGlobalFilters(new PrismaExceptionFilter());

  // Security middleware
  // app.use(helmet());

  // Compression
  app.use(compression());

  // CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Configuration du dossier de téléchargement
  const uploadsPath = join(__dirname, '..', '..', 'uploads');
  console.log('Uploads directory path:', uploadsPath);
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads',
  });

  // app.useGlobalInterceptors(new RequestLoggerInterceptor());

  // Liaison du Swagger
  const config = new DocumentBuilder()
    .setTitle('Audit App API')
    .setDescription('The Audit App API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentFactory = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, documentFactory);

  // Lancer le serveur
  await app.listen(process.env.PORT ?? 8080, '0.0.0.0');
}
bootstrap();
