import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ZodValidationPipe } from 'nestjs-zod';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const globalPrefix = config.get<string>('GLOBAL_PREFIX') ?? 'api';
  const port = config.get<number>('PORT') ?? 3000;
  const corsOrigin =
    config.get<string>('CORS_ORIGIN') ?? 'http://localhost:4200';
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';

  app.setGlobalPrefix(globalPrefix);
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(new ZodValidationPipe());
  app.enableShutdownHooks();

  // ─── Swagger ────────────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('@org/api')
      .setDescription('Backend API — Auth, Users, Health')
      .setVersion('1.0.0')
      .addCookieAuth('access_token', {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'HttpOnly cookie set on login/register',
      })
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer',
      )
      .addTag('auth', 'Authentication & session management')
      .addTag('users', 'User management')
      .addTag('health', 'Health checks')
      .addTag('config', 'Public configuration')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      customCssUrl:
        'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css',
      customJs: [
        'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js',
        'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js',
      ],
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
    Logger.log(`📖 Swagger at http://localhost:${port}/docs`);
  }

  await app.listen(port);
  Logger.log(`🚀 API running at http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
