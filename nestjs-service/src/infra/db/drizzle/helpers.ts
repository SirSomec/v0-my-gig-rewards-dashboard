import { readFileSync } from 'fs';

export function getConnectionData(databaseUrl: string): [string, object] {
  const url = new URL(databaseUrl);

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

  return [url.toString(), config];
}
