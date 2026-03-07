import { readFileSync, existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres, { Sql } from 'postgres';
import type { Envs } from '../../../shared/env.validation-schema';

const PREVIEW_LIMIT = 100;
const CUSTOM_QUERY_LIMIT = 200;

/** Читает переменную из ConfigService или напрямую из process.env (для Docker env_file). */
function getEtlEnv(config: ConfigService<Envs, true>, key: keyof Envs): string | undefined {
  const v = config.get<string>(key);
  if (v != null && String(v).trim() !== '') return String(v).trim();
  const raw = process.env[key];
  return raw != null && String(raw).trim() !== '' ? String(raw).trim() : undefined;
}

@Injectable()
export class EtlExplorerService {
  constructor(private readonly config: ConfigService<Envs, true>) {}

  isConfigured(): boolean {
    const host = getEtlEnv(this.config, 'ETL_HOST');
    const user = getEtlEnv(this.config, 'ETL_USER');
    const password = getEtlEnv(this.config, 'ETL_PASSWORD');
    return !!(host && user && password);
  }

  /** Для диагностики: какие переменные ETL заданы (значения не возвращаем). */
  getEnvStatus(): { ETL_HOST: boolean; ETL_PORT: boolean; ETL_USER: boolean; ETL_PASSWORD: boolean; ETL_DATABASE: boolean; ETL_SSL_ROOT_CERT: boolean } {
    const get = (key: keyof Envs) => !!getEtlEnv(this.config, key);
    return {
      ETL_HOST: get('ETL_HOST'),
      ETL_PORT: get('ETL_PORT'),
      ETL_USER: get('ETL_USER'),
      ETL_PASSWORD: get('ETL_PASSWORD'),
      ETL_DATABASE: get('ETL_DATABASE'),
      ETL_SSL_ROOT_CERT: get('ETL_SSL_ROOT_CERT'),
    };
  }

  private buildConnection(): { client: Sql; end: () => Promise<void> } {
    const host = getEtlEnv(this.config, 'ETL_HOST');
    const user = getEtlEnv(this.config, 'ETL_USER');
    const password = getEtlEnv(this.config, 'ETL_PASSWORD');

    if (!host || !user || !password) {
      throw new Error('ETL_HOST, ETL_USER and ETL_PASSWORD are required');
    }

    const port = getEtlEnv(this.config, 'ETL_PORT') || '5432';
    const database = getEtlEnv(this.config, 'ETL_DATABASE') || user;
    const sslRootCert = getEtlEnv(this.config, 'ETL_SSL_ROOT_CERT');

    const url = new URL('postgres://');
    url.hostname = host;
    url.port = port;
    url.username = encodeURIComponent(user);
    url.password = encodeURIComponent(password);
    url.pathname = `/${encodeURIComponent(database)}`;

    const opts: { max: number; ssl?: { ca: Buffer[] }; connection?: { application_name: string } } = {
      max: 1,
      connection: { application_name: 'mygig-etl-explorer' },
    };
    if (sslRootCert && existsSync(sslRootCert)) {
      opts.ssl = { ca: [readFileSync(sslRootCert)] };
    }

    const client = postgres(url.toString(), {
      ...opts,
      max_lifetime: 60,
      idle_timeout: 10,
      connect_timeout: 10,
    });

    return {
      client,
      end: () => client.end({ timeout: 5 }),
    };
  }

  private async runWithClient<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
    const { client, end } = this.buildConnection();
    try {
      return await fn(client);
    } finally {
      await end();
    }
  }

  async getSchemas(): Promise<{ schema_name: string }[]> {
    return this.runWithClient(async (sql) => {
      const rows = await sql`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1')
        ORDER BY schema_name
      `;
      return rows as unknown as { schema_name: string }[];
    });
  }

  async getTables(schema: string): Promise<{ table_name: string }[]> {
    return this.runWithClient(async (sql) => {
      const rows = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ${schema}
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
      return rows as unknown as { table_name: string }[];
    });
  }

  async getColumns(schema: string, table: string): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
    return this.runWithClient(async (sql) => {
      const rows = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${table}
        ORDER BY ordinal_position
      `;
      return rows as unknown as { column_name: string; data_type: string; is_nullable: string }[];
    });
  }

  async getPreview(schema: string, table: string, limit: number = PREVIEW_LIMIT): Promise<Record<string, unknown>[]> {
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid schema or table name');
    }
    const limitNum = Math.min(Math.max(1, limit), PREVIEW_LIMIT);
    return this.runWithClient(async (sql) => {
      const rows = await sql.unsafe(
        `SELECT * FROM "${schema}"."${table}" LIMIT $1`,
        [limitNum],
      );
      return (rows as Record<string, unknown>[]) || [];
    });
  }

  private isSelectOnly(query: string): boolean {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed.startsWith('SELECT')) return false;
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
    const upper = query.toUpperCase();
    for (const kw of forbidden) {
      if (upper.includes(kw)) return false;
    }
    return true;
  }

  async runQuery(rawSql: string): Promise<{ rows: Record<string, unknown>[]; limited: boolean }> {
    if (!this.isSelectOnly(rawSql)) {
      throw new Error('Only SELECT queries are allowed');
    }
    let sql = rawSql.trim();
    const hasLimit = /\bLIMIT\s+\d+/i.test(sql);
    if (!hasLimit) {
      sql += ` LIMIT ${CUSTOM_QUERY_LIMIT}`;
    }
    const rows = await this.runWithClient(async (client) => {
      const result = await client.unsafe(sql, []);
      return (result as Record<string, unknown>[]) || [];
    });
    return { rows, limited: !hasLimit };
  }
}
