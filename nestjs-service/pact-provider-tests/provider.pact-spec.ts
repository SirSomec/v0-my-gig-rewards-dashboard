import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Verifier } from '@pact-foundation/pact';
import { VerifierOptions } from '@pact-foundation/pact/src/dsl/verifier/types';
import { ConsumerVersionSelector } from '@pact-foundation/pact-core/src/verifier/types';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { StartedPostgreSqlContainer } from '@testcontainers/postgresql/build/postgresql-container';
import { Wait } from 'testcontainers';

import { AppModule } from '../src/app.module';
import { runPgMigrations } from './helpers';

const envs: Record<string, unknown> = {
  ...process.env,
  PORT: 5000,
  NODE_ENV: 'test',
  SERVICE_USERNAME: 'admin',
  SERVICE_PASSWORD: 'admin',
};

const mockConfigService = {
  get: jest.fn((key: string) => envs[key]),
  getOrThrow: jest.fn((key: string) => {
    const variable = envs[key];

    if (typeof variable === 'undefined') {
      throw new Error(`TypeError: Configuration key "${key}" does not exist`);
    }

    return variable;
  }),
};

describe('Pact consumer tests', () => {
  let app: INestApplication;
  let configService: ConfigService;
  let PORT: number;

  let postgresqlStartedContainer: StartedPostgreSqlContainer;

  beforeAll(async () => {
    postgresqlStartedContainer = await new PostgreSqlContainer(
      'postgres:16-alpine',
    )
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/i),
      )
      .withStartupTimeout(600000)
      .start();

    const postgresUsername = postgresqlStartedContainer.getUsername();
    const postgresPassword = postgresqlStartedContainer.getPassword();
    const postgresHost = postgresqlStartedContainer.getHost();
    const postgresPort = postgresqlStartedContainer.getPort();
    const postgresDatabase = postgresqlStartedContainer.getDatabase();

    envs.DATABASE_URL = `postgres://${postgresUsername}:${postgresPassword}@${postgresHost}:${postgresPort}/${postgresDatabase}`;

    await runPgMigrations(envs.DATABASE_URL as string);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(mockConfigService)
      .compile();

    app = moduleRef.createNestApplication();

    configService = app.get<ConfigService>(ConfigService);
    PORT = configService.get<number>('PORT')!;

    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.listen(PORT);

    await app.init();
  }, 6000000);

  afterAll(async () => {
    await app.close();
  });

  it('Check consumers', async () => {
    const PACT_BROKER_URL = configService.get<string>('PACT_BROKER_URL')!;
    const PACT_BROKER_USERNAME = configService.get<string>(
      'PACT_BROKER_USERNAME',
    )!;
    const PACT_BROKER_PASSWORD = configService.get<string>(
      'PACT_BROKER_PASSWORD',
    )!;
    const PROVIDER_VERSION = configService.get<string>('PROVIDER_VERSION')!;
    const PROVIDER_VERSION_BRANCH = configService.get<string>(
      'PROVIDER_VERSION_BRANCH',
    )!;
    const CONSUMER_VERSION_BRANCH = configService.get<string>(
      'CONSUMER_VERSION_BRANCH',
    )!;

    const consumerVersionSelectors: ConsumerVersionSelector[] = [
      { matchingBranch: true },
      { mainBranch: true },
    ];

    if (CONSUMER_VERSION_BRANCH) {
      consumerVersionSelectors.push({ branch: CONSUMER_VERSION_BRANCH });
    }

    const opts: VerifierOptions = {
      provider: '<SERVICE_SLUG>',
      providerBaseUrl: `http://localhost:${PORT}`,
      pactBrokerUrl: PACT_BROKER_URL,
      pactBrokerUsername: PACT_BROKER_USERNAME,
      pactBrokerPassword: PACT_BROKER_PASSWORD,
      publishVerificationResult: true,
      providerVersion: PROVIDER_VERSION,
      providerVersionBranch: PROVIDER_VERSION_BRANCH,
      consumerVersionSelectors: consumerVersionSelectors,
    };

    await new Verifier(opts).verifyProvider();
  });
});
