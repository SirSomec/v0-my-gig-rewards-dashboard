import { defineConfig } from 'drizzle-kit';

/* Только для генерации миграций */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/db/drizzle/schemas/index.ts',
  out: './migrations',
  verbose: true,
});
