import { readFileSync, existsSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres, { Sql } from 'postgres';
import type { Envs } from '../../../shared/env.validation-schema';

const PREVIEW_LIMIT = 100;
const CUSTOM_QUERY_LIMIT = 200;

@Injectable()
export class EtlExplorerService {
  constructor(private readonly config: ConfigService<Envs, true>) {}

  isConfigured(): boolean {
    const host = this.config.get<string>('ETL_HOST');
    const user = this.config.get<string>('ETL_USER');
    const password = this.config.get<string>('ETL_PASSWORD');
    return !!(host && user && password);
  }

  private buildConnection(): { client: Sql; end: () => Promise<void> } {
    const host = this.config.getOrThrow<string>('ETL_HOST');
    const port = this.config.get<string>('ETL_PORT') || '5432';
    const user = this.config.getOrThrow<string>('ETL_USER');
    const password = this.config.getOrThrow<string>('ETL_PASSWORD');
    const database = this.config.get<string>('ETL_DATABASE') || user;
    const sslRootCert = this.config.get<string>('ETL_SSL_ROOT_CERT');

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
