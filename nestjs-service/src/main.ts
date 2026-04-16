import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ShutdownSignal, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'body-parser';
import { mkdirSync } from 'fs';
import { runMigrations } from './infra/db/drizzle/run-migrations';
import { getRafflePrizeUploadDir } from './shared/raffle-upload-path';

async function bootstrap() {
  const databaseUrl = process.env['DATABASE_URL'] ?? process.env['PG_CONNECTION'];
  if (databaseUrl) {
    const migrationsFolder = process.env['MIGRATIONS_PATH'] ?? './migrations';
    await runMigrations(databaseUrl, migrationsFolder);
  }

  const jsonBodyLimit =
    process.env['HTTP_JSON_BODY_LIMIT'] ??
    process.env['JSON_BODY_LIMIT'] ??
    '15mb';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.use(json({ limit: jsonBodyLimit }));
  app.use(urlencoded({ limit: jsonBodyLimit, extended: true }));

  const rafflePrizeDir = getRafflePrizeUploadDir();
  mkdirSync(rafflePrizeDir, { recursive: true });
  app.useStaticAssets(rafflePrizeDir, { prefix: '/v1/uploads/raffle-prizes' });

  app.enableCors({ origin: true }); // разрешаем запросы с любого origin (фронт на другом порту/домене)

  app.enableShutdownHooks([ShutdownSignal.SIGTERM]);

  const configService = app.get<ConfigService>(ConfigService);

  const DOC_RELATIVE_PATH: string =
    configService.get<string>('DOC_RELATIVE_PATH') || 'api/doc';

  const config = new DocumentBuilder()
    .setTitle('<SERVICE_NAME>')
    .setDescription('<SERVICE_NAME> documentation')
    .setVersion('1.0')
    .addSecurity('basic', {
      type: 'http',
      scheme: 'basic',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOC_RELATIVE_PATH, app, document);

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const PORT = configService.get<number>('PORT') || 3000;

  await app.listen(PORT, '0.0.0.0');
}
bootstrap();
