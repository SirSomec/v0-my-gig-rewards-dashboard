import { readFileSync } from 'fs';

import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schemas from './schemas';

export const drizzleProvider = 'drizzleProvider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: drizzleProvider,
      useFactory: (configService: ConfigService) => {
        const DATABASE_URL =
          configService.get<string>('DATABASE_URL') ??
          configService.getOrThrow<string>('PG_CONNECTION');
        const loggerOn = configService.get<string>('NODE_ENV') !== 'production';

        const url = new URL(DATABASE_URL);

        const sslrootcert = url.searchParams.get('sslrootcert');

        const config = {
          ...(sslrootcert !== null && {
            ssl: {
              ca: [readFileSync(sslrootcert)],
            },
          }),
        };

        if (sslrootcert) {
          url.searchParams.delete('sslrootcert');
        }

        const client = postgres(url.toString(), config);

        return drizzle(client, { schema: schemas, logger: loggerOn });
      },
      inject: [ConfigService],
    },
  ],
  exports: [drizzleProvider],
})
export class DrizzleModule {}
