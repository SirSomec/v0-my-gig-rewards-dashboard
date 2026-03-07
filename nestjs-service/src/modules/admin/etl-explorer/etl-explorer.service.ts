import { readFileSync, existsSync } from 'fs';
import * as https from 'https';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import postgres, { Sql } from 'postgres';
import type { Envs } from '../../../shared/env.validation-schema';

const PREVIEW_LIMIT = 100;
const CUSTOM_QUERY_LIMIT = 200;

/** Порт ClickHouse HTTPS API (Yandex Cloud). При ETL_PORT=8443 используется HTTP API, а не PostgreSQL. */
const CLICKHOUSE_HTTPS_PORT = '8443';

/** Путь к CA в образе Docker (сертификаты Yandex Cloud загружаются при сборке). */
const ETL_DEFAULT_CA_PATH = '/app/certs/YandexCloudCA.pem';

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

  /** True, если ETL — ClickHouse (порт 8443, HTTPS API). Иначе — PostgreSQL. */
  private isClickHouse(): boolean {
    return getEtlEnv(this.config, 'ETL_PORT') === CLICKHOUSE_HTTPS_PORT;
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

  /** Ключи с префиксом ETL_ в process.env (для диагностики: видит ли контейнер переменные). */
  getProcessEnvEtlKeys(): string[] {
    return Object.keys(process.env).filter((k) => k.startsWith('ETL_'));
  }

  /** Текущая база и пользователь ETL (для проверки подключения). */
  async getConnectionInfo(): Promise<{ database: string; user: string }> {
    if (this.isClickHouse()) return this.getConnectionInfoClickHouse();
    return this.runWithClient(async (sql) => {
      const rows = await sql`SELECT current_database() AS database, current_user AS "user"`;
      const r = (rows as unknown as { database: string; user: string }[])[0];
      return r ?? { database: '', user: '' };
    });
  }

  /** Список баз данных в кластере ETL (для выбора ETL_DATABASE в .env). */
  async getDatabases(): Promise<{ datname: string }[]> {
    if (this.isClickHouse()) return this.getDatabasesClickHouse();
    return this.runWithClient(async (sql) => {
      const rows = await sql`
        SELECT datname
        FROM pg_catalog.pg_database
        WHERE datistemplate = false
        ORDER BY datname
      `;
      return rows as unknown as { datname: string }[];
    });
  }

  /**
   * За один коннект возвращает connectionInfo, databases и schemas — чтобы не открывать
   * несколько параллельных подключений к ETL (избегаем ECONNRESET на Managed PostgreSQL).
   */
  async getIntro(): Promise<{
    connectionInfo: { database: string; user: string };
    databases: { datname: string }[];
    schemas: { schema_name: string }[];
  }> {
    if (this.isClickHouse()) return this.getIntroClickHouse();
    return this.runWithClient(async (sql) => {
      const connRows = await sql`SELECT current_database() AS database, current_user AS "user"`;
      const dbRows = await sql`
        SELECT datname FROM pg_catalog.pg_database WHERE datistemplate = false ORDER BY datname
      `;
      let schemaRows: { schema_name: string }[];
      try {
        const fromPg = await sql`
          SELECT nspname AS schema_name FROM pg_catalog.pg_namespace
          WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema'
          ORDER BY nspname
        `;
        schemaRows = fromPg as unknown as { schema_name: string }[];
        if (schemaRows.length === 0) throw new Error('empty');
      } catch {
        schemaRows = (await sql`
          SELECT schema_name FROM information_schema.schemata
          WHERE schema_name NOT IN ('pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'information_schema')
          ORDER BY schema_name
        `) as unknown as { schema_name: string }[];
      }
      const conn = (connRows as unknown as { database: string; user: string }[])[0] ?? { database: '', user: '' };
      const databases = dbRows as unknown as { datname: string }[];
      return { connectionInfo: conn, databases, schemas: schemaRows };
    });
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
    const sslRootCert =
      getEtlEnv(this.config, 'ETL_SSL_ROOT_CERT') ||
      (existsSync(ETL_DEFAULT_CA_PATH) ? ETL_DEFAULT_CA_PATH : undefined);

    const url = new URL('postgres://');
    url.hostname = host;
    url.port = port;
    url.username = encodeURIComponent(user);
    url.password = encodeURIComponent(password);
    url.pathname = `/${encodeURIComponent(database)}`;
    if (sslRootCert && existsSync(sslRootCert)) {
      url.searchParams.set('sslmode', 'verify-full');
    }

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
      connect_timeout: 20,
    });

    return {
      client,
      end: () => client.end({ timeout: 5 }),
    };
  }

  /** Выполняет запрос к ClickHouse по HTTPS (порт 8443), возвращает массив объектов (JSONEachRow). */
  private clickHouseRequest<T = Record<string, unknown>>(
    query: string,
    database?: string,
  ): Promise<T[]> {
    const host = getEtlEnv(this.config, 'ETL_HOST');
    const user = getEtlEnv(this.config, 'ETL_USER');
    const password = getEtlEnv(this.config, 'ETL_PASSWORD');
    if (!host || !user || !password) {
      return Promise.reject(new Error('ETL_HOST, ETL_USER and ETL_PASSWORD are required'));
    }
    const db = database ?? getEtlEnv(this.config, 'ETL_DATABASE') ?? 'default';
    const caPath =
      getEtlEnv(this.config, 'ETL_SSL_ROOT_CERT') ||
      (existsSync(ETL_DEFAULT_CA_PATH) ? ETL_DEFAULT_CA_PATH : undefined);
    const options: https.RequestOptions = {
      method: 'GET',
      hostname: host,
      port: 8443,
      path: `/?query=${encodeURIComponent(query.trimEnd() + ' FORMAT JSONEachRow')}&database=${encodeURIComponent(db)}`,
      headers: {
        'X-ClickHouse-User': user,
        'X-ClickHouse-Key': password,
      },
    };
    if (caPath && existsSync(caPath)) {
      options.ca = readFileSync(caPath);
    }
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`ClickHouse HTTP ${res.statusCode}: ${body.slice(0, 500)}`));
            return;
          }
          const rows: T[] = [];
          const lines = body.split(/\r?\n/).filter((s) => s.trim());
          for (const line of lines) {
            try {
              rows.push(JSON.parse(line) as T);
            } catch {
              // skip malformed lines
            }
          }
          resolve(rows);
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  private async getConnectionInfoClickHouse(): Promise<{ database: string; user: string }> {
    const rows = await this.clickHouseRequest<{ database: string; user: string }>(
      'SELECT currentDatabase() AS database, currentUser() AS user',
    );
    const r = rows[0];
    return r ?? { database: '', user: '' };
  }

  private async getDatabasesClickHouse(): Promise<{ datname: string }[]> {
    const rows = await this.clickHouseRequest<{ name: string }>('SHOW DATABASES');
    return rows.map((row) => ({ datname: row.name }));
  }

  private async getIntroClickHouse(): Promise<{
    connectionInfo: { database: string; user: string };
    databases: { datname: string }[];
    schemas: { schema_name: string }[];
  }> {
    const [connectionInfo, databases] = await Promise.all([
      this.getConnectionInfoClickHouse(),
      this.getDatabasesClickHouse(),
    ]);
    const schemas = databases.map((d) => ({ schema_name: d.datname }));
    return { connectionInfo, databases, schemas };
  }

  /**
   * Данные пользователя из ETL (таблица etl.mg_users): _id, firstname, lastname.
   * Используется при создании пользователя в админке для подстановки имени в личный кабинет.
   */
  async getMgUserByExternalId(externalId: string): Promise<{ _id: string; firstname: string; lastname: string } | null> {
    if (!externalId?.trim()) return null;
    if (!this.isClickHouse()) return null;
    const escaped = String(externalId).trim().replace(/'/g, "''");
    const rows = await this.clickHouseRequest<{ _id: string; firstname: string; lastname: string }>(
      `SELECT \`_id\`, \`firstname\`, \`lastname\` FROM \`etl\`.\`mg_users\` WHERE \`_id\` = '${escaped}' LIMIT 1`,
      'etl',
    );
    const r = rows[0];
    if (!r || r._id == null) return null;
    return {
      _id: String(r._id),
      firstname: r.firstname != null ? String(r.firstname) : '',
      lastname: r.lastname != null ? String(r.lastname) : '',
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
    if (this.isClickHouse()) {
      const rows = await this.clickHouseRequest<{ name: string }>('SHOW DATABASES');
      return rows.map((r) => ({ schema_name: r.name }));
    }
    return this.runWithClient(async (sql) => {
      // Сначала через pg_namespace (в Managed PostgreSQL часто надёжнее)
      try {
        const fromPgNamespace = await sql`
          SELECT nspname AS schema_name
          FROM pg_catalog.pg_namespace
          WHERE nspname NOT LIKE 'pg_%'
            AND nspname != 'information_schema'
          ORDER BY nspname
        `;
        const rows = fromPgNamespace as unknown as { schema_name: string }[];
        if (rows.length > 0) return rows;
      } catch {
        // игнорируем, пробуем information_schema
      }
      const rows = await sql`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1', 'information_schema')
        ORDER BY schema_name
      `;
      return rows as unknown as { schema_name: string }[];
    });
  }

  async getTables(schema: string): Promise<{ table_name: string }[]> {
    if (!/^[a-zA-Z0-9_]+$/.test(schema)) throw new Error('Invalid schema name');
    if (this.isClickHouse()) {
      const rows = await this.clickHouseRequest<{ name: string }>(
        `SHOW TABLES FROM \`${schema.replace(/`/g, '')}\``,
      );
      return rows.map((r) => ({ table_name: r.name }));
    }
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
    if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) {
      throw new Error('Invalid schema or table name');
    }
    const schemaSafe = schema.replace(/`/g, '');
    const tableSafe = table.replace(/`/g, '');
    if (this.isClickHouse()) {
      const rows = await this.clickHouseRequest<{ name: string; type: string }>(
        `SELECT name, type FROM system.columns WHERE database = '${schemaSafe}' AND table = '${tableSafe}' ORDER BY position`,
      );
      return rows.map((r) => ({
        column_name: r.name,
        data_type: r.type,
        is_nullable: r.type.startsWith('Nullable(') ? 'YES' : 'NO',
      }));
    }
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
    const schemaSafe = schema.replace(/`/g, '');
    const tableSafe = table.replace(/`/g, '');
    if (this.isClickHouse()) {
      return this.clickHouseRequest(
        `SELECT * FROM \`${schemaSafe}\`.\`${tableSafe}\` LIMIT ${limitNum}`,
      );
    }
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
    if (this.isClickHouse()) {
      const rows = await this.clickHouseRequest(sql);
      return { rows, limited: !hasLimit };
    }
    const rows = await this.runWithClient(async (client) => {
      const result = await client.unsafe(sql, []);
      return (result as Record<string, unknown>[]) || [];
    });
    return { rows, limited: !hasLimit };
  }
}
