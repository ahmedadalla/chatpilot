import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import { validateEnv } from '@chatpilot/config';
import { AppModule } from './app.module';

const logger = pino({
  name: 'chatpilot-api',
  level: process.env['LOG_LEVEL'] || 'info',
});

async function bootstrap() {
  // 1. Boot-time environment validation (fail-fast)
  const env = validateEnv();
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Environment successfully validated');

  // 2. Initialize NestJS Application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // 3. Security Headers via Helmet & Cookie Parser
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser());

  // 4. CORS configuration
  app.enableCors({
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });

  // 5. Global API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['healthz', 'readyz', 'metrics'],
  });

  // 6. OpenAPI / Swagger documentation (development / staging)
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ChatPilot Modular Monolith API')
      .setDescription('Production-grade conversational commerce engine API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // 7. Start listening
  await app.listen(env.PORT, '0.0.0.0');
  logger.info(`ChatPilot API is running on http://0.0.0.0:${env.PORT}`);
}

void bootstrap();
