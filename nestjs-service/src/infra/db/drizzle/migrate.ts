// eslint-disable-next-line @typescript-eslint/no-require-imports,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
require('dotenv').config();

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { getConnectionData } from './helpers';

async function main() {
  const databaseUrl = process.env['DATABASE_URL'] ?? process.env['PG_CONNECTION']!;

  const [url, config] = getConnectionData(databaseUrl);

  const migrationClient = postgres(url.toString(), config);

  await migrate(drizzle(migrationClient, { logger: true }), {
    migrationsFolder: process.env['MIGRATIONS_PATH'] ?? './migrations',
  });
  await migrationClient.end();
}

main();
