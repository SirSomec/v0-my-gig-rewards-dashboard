import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getConnectionData } from './helpers';

/**
 * Применяет все неприменённые миграции к БД.
 * Вызывается при старте приложения.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder: string = './migrations',
): Promise<void> {
  const [url, config] = getConnectionData(databaseUrl);
  const migrationClient = postgres(url.toString(), config);
  try {
    await migrate(drizzle(migrationClient, { logger: false }), {
      migrationsFolder,
    });
  } finally {
    await migrationClient.end();
  }
}
