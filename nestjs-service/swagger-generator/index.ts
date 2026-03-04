import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { RedisService } from '../src/infra/db/redis/redis.service';
import { HealthCheckService } from '../src/infra/health/health-check.service';

const OUTPUT_PATH = join(process.cwd(), 'swagger.json');

function setEnvDefaults(): void {
  const defaults: Record<string, string> = {
    NODE_ENV: 'local',
    PORT: '3000',
    PG_CONNECTION: 'postgres://mock-user:mock-password@127.0.0.1:5432/mock-db',
    DATABASE_URL: 'postgres://mock-user:mock-password@127.0.0.1:5432/mock-db',
    MONGO_CONNECTION: 'mongodb://mock-host:27017/mock',
    SERVICE_USERNAME: 'mock-user',
    SERVICE_PASSWORD: 'mock-password',
    REDIS_DB: '0',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'mock-password',
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  // Template code currently mixes both names; keep them aligned for generation.
  if (process.env.DATABASE_URL === undefined && process.env.PG_CONNECTION) {
    process.env.DATABASE_URL = process.env.PG_CONNECTION;
  }

  if (process.env.PG_CONNECTION === undefined && process.env.DATABASE_URL) {
    process.env.PG_CONNECTION = process.env.DATABASE_URL;
  }
}

function buildDocumentConfig() {
  return new DocumentBuilder()
    .setTitle('Dictionaries')
    .setDescription('Dictionaries documentation')
    .setVersion('1.0')
    .addSecurity('basic', {
      type: 'http',
      scheme: 'basic',
    })
    .build();
}

function createMongooseConnectionMock() {
  return {
    readyState: 1,
    model: () => ({}),
    close: async () => undefined,
    startSession: async () => ({
      startTransaction: () => undefined,
      commitTransaction: async () => undefined,
      abortTransaction: async () => undefined,
      endSession: async () => undefined,
    }),
  };
}

function createRedisServiceMock(): RedisService {
  const redisClientMock = {
    status: 'ready',
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    scan: async () => ['0', []] as [string, string[]],
    flushdb: async () => 'OK',
    quit: async () => 'OK',
  };

  return {
    getClient: () => redisClientMock,
  } as unknown as RedisService;
}

function loadDrizzleHealthIndicatorToken(): any {
  // The package does not export this token from the root entrypoint.
  const modulePath = join(
    process.cwd(),
    'node_modules',
    '@mygigtechnologies',
    'healthcheck',
    'dist',
    'health',
    'indicators',
    'drizzle-health.indicator.js',
  );

  const indicatorModule = require(modulePath) as {
    DrizzleHealthIndicator: unknown;
  };

  return indicatorModule.DrizzleHealthIndicator;
}

function patchHealthcheckModule(): void {
  const drizzleHealthIndicatorToken = loadDrizzleHealthIndicatorToken();
  const healthcheckPackage = require('@mygigtechnologies/healthcheck') as {
    HealthModule: {
      forRootAsync: (options: unknown) => {
        providers?: Array<unknown>;
      };
      __swaggerPatched?: boolean;
    };
  };

  if (healthcheckPackage.HealthModule.__swaggerPatched) {
    return;
  }

  const originalForRootAsync =
    healthcheckPackage.HealthModule.forRootAsync.bind(
      healthcheckPackage.HealthModule,
    );

  healthcheckPackage.HealthModule.forRootAsync = (options: unknown) => {
    const moduleDefinition = originalForRootAsync(options);
    const providers = [...(moduleDefinition.providers ?? [])];
    const hasDrizzleProvider = providers.some((provider) =>
      typeof provider === 'function'
        ? provider === drizzleHealthIndicatorToken
        : (provider as { provide?: unknown }).provide ===
          drizzleHealthIndicatorToken,
    );

    if (!hasDrizzleProvider) {
      providers.push({
        provide: drizzleHealthIndicatorToken,
        useValue: {
          pingCheck: async () => ({ drizzle: { status: 'up' } }),
        },
      });
    }

    return {
      ...moduleDefinition,
      providers,
    };
  };

  healthcheckPackage.HealthModule.__swaggerPatched = true;
}

async function generateSwaggerJson(): Promise<void> {
  setEnvDefaults();
  patchHealthcheckModule();

  const { AppModule } =
    require('../src/app.module') as typeof import('../src/app.module');
  const mongooseConnectionMock = createMongooseConnectionMock();
  const redisServiceMock = createRedisServiceMock();

  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getConnectionToken())
    .useValue(mongooseConnectionMock)
    .overrideProvider(RedisService)
    .useValue(redisServiceMock)
    .overrideProvider(HealthCheckService)
    .useValue({ createHealthOptions: () => [] })
    .compile();

  const app = testingModule.createNestApplication({ logger: false });
  await app.init();

  const documentConfig = buildDocumentConfig();
  const document: OpenAPIObject = SwaggerModule.createDocument(
    app,
    documentConfig,
  );

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(document, null, 2)}\n`,
    'utf8',
  );

  const appModule = testingModule.get<{ onModuleDestroy: () => void }>(
    AppModule,
  );
  appModule.onModuleDestroy = () => undefined;
  await app.close();
}

async function main(): Promise<void> {
  try {
    await generateSwaggerJson();
    process.stdout.write(`Swagger JSON generated: ${OUTPUT_PATH}\n`);
  } catch (error) {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`Swagger generation failed:\n${message}\n`);
    process.exitCode = 1;
  }
}

void main();
