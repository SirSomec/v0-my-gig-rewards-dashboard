import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ShutdownSignal, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(PORT);
}
bootstrap();
