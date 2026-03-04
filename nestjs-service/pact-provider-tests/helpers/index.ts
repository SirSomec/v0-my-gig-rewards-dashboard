import { exec } from 'child_process';
import * as path from 'node:path';

export async function runPgMigrations(pgUrl: string) {
  await new Promise((resolve, reject) => {
    exec(
      `npm run db:migrate:local`,
      {
        env: {
          ...process.env,
          MIGRATIONS_PATH: path.resolve('migrations'),
          DATABASE_URL: pgUrl,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        if (stderr) {
          reject(stderr);
          return;
        }
        resolve(stdout);
      },
    );
  });
}
