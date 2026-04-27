import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
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

  // Security middleware (Helmet : Headers HTTP de sécurité)
  app.use(
    helmet({
      // Nécessaire pour Swagger en dev. À durcir si Swagger n'est pas exposé en prod.
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Compression
  app.use(compression());

  // CORS strict : whitelist explicite des origines autorisées
  // CORS_ORIGIN dans .env = liste séparée par virgules
  // Ex: "https://audit-web.lunion-lab.com,http://audit-web.lunion-lab.com,http://localhost:3000,http://localhost:3100"
  const corsOriginsRaw =
    process.env.CORS_ORIGIN ||
    process.env.FRONTEND_URL ||
    'https://audit-web.lunion-lab.com';

  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  console.log('CORS allowed origins:', corsOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      // Pas d'origin (curl, Postman, server-to-server) → autorisé
      if (!origin) return callback(null, true);

      // Whitelist exacte
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      // En dev, on accepte tout localhost peu importe le port
      if (!isProduction && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      console.warn(`CORS bloqué pour origin : ${origin}`);
      callback(new Error(`Origin ${origin} non autorisée par CORS`));
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type,Authorization,Accept,X-Requested-With',
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
