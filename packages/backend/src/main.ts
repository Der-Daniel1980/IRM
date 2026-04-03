import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS
  if (process.env.APP_ENV !== 'development' && !process.env.CORS_ORIGIN) {
    console.warn(
      '[SECURITY] CORS_ORIGIN ist nicht gesetzt. Im Produktionsbetrieb sollte CORS_ORIGIN explizit konfiguriert werden.',
    );
  }
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3002'],
    credentials: true,
  });

  // API prefix (Swagger-Docs sind außerhalb des API-Prefix)
  app.setGlobalPrefix('api/v1', {
    exclude: ['api/docs', 'api/docs-json', 'health'],
  });

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('IRM API')
    .setDescription('Immobilien- & Ressourcenmanagement API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'keycloak-jwt',
    )
    .addTag('customers', 'Kundenverwaltung')
    .addTag('properties', 'Immobilienverwaltung')
    .addTag('staff', 'Personalverwaltung')
    .addTag('skills', 'Fähigkeiten-Katalog')
    .addTag('equipment', 'Maschinen & KFZ')
    .addTag('activity-types', 'Tätigkeitskatalog')
    .addTag('work-orders', 'Auftragsmanagement')
    .addTag('absences', 'Abwesenheitsverwaltung')
    .addTag('formulas', 'Formel-Designer')
    .addTag('scheduling', 'Einsatzplanung')
    .addTag('route-sheets', 'Laufzettel')
    .addTag('map', 'Kartenansicht')
    .addTag('dashboard', 'Dashboard')
    .addTag('admin', 'Administration')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.APP_PORT ?? 3001;
  await app.listen(port);
  logger.log(`IRM Backend running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
