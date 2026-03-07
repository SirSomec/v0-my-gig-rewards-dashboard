import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from '../admin.guard';
import { EtlExplorerService } from './etl-explorer.service';

@ApiTags('admin')
@Controller({ path: 'admin/etl-explorer', version: '1' })
@UseGuards(AdminGuard)
export class EtlExplorerController {
  constructor(private readonly etl: EtlExplorerService) {}

  private ensureConfigured(): void {
    if (!this.etl.isConfigured()) {
      throw new ServiceUnavailableException(
        'ETL is not configured. Set ETL_HOST, ETL_PORT, ETL_USER, ETL_PASSWORD in env.',
      );
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Проверка: настроено ли подключение к ETL' })
  getStatus(): { configured: boolean; env?: Record<string, boolean>; processEnvEtlKeys?: string[] } {
    const configured = this.etl.isConfigured();
    const env = this.etl.getEnvStatus();
    const processEnvEtlKeys = this.etl.getProcessEnvEtlKeys();
    return { configured, env, processEnvEtlKeys };
  }

  @Get('connection-info')
  @ApiOperation({ summary: 'Текущая база и пользователь ETL (для проверки подключения)' })
  async getConnectionInfo(): Promise<{ database: string; user: string }> {
    this.ensureConfigured();
    return this.etl.getConnectionInfo();
  }

  @Get('databases')
  @ApiOperation({ summary: 'Список баз данных в кластере ETL' })
  async getDatabases(): Promise<{ datname: string }[]> {
    this.ensureConfigured();
    return this.etl.getDatabases();
  }

  @Get('intro')
  @ApiOperation({ summary: 'За один коннект: connectionInfo + databases + schemas (меньше ECONNRESET)' })
  async getIntro(): Promise<{
    connectionInfo: { database: string; user: string };
    databases: { datname: string }[];
    schemas: { schema_name: string }[];
  }> {
    this.ensureConfigured();
    try {
      return await this.etl.getIntro();
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e ? (e as { code: string }).code : '';
      if (code === 'ECONNRESET') {
        throw new ServiceUnavailableException(
          'Подключение к ETL разорвано (ECONNRESET). Проверьте ETL_HOST и ETL_PORT: для ClickHouse (Yandex) укажите ETL_PORT=8443 (HTTPS API), для PostgreSQL — обычно 6432. Перезапустите api после смены .env.',
        );
      }
      throw e;
    }
  }

  @Get('schemas')
  @ApiOperation({ summary: 'Список схем БД ETL' })
  async getSchemas(): Promise<{ schema_name: string }[]> {
    this.ensureConfigured();
    return this.etl.getSchemas();
  }

  @Get('tables')
  @ApiOperation({ summary: 'Список таблиц в схеме' })
  async getTables(@Query('schema') schema: string): Promise<{ table_name: string }[]> {
    this.ensureConfigured();
    if (!schema?.trim()) throw new BadRequestException('schema is required');
    return this.etl.getTables(schema.trim());
  }

  @Get('columns')
  @ApiOperation({ summary: 'Колонки таблицы' })
  async getColumns(
    @Query('schema') schema: string,
    @Query('table') table: string,
  ): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
    this.ensureConfigured();
    if (!schema?.trim()) throw new BadRequestException('schema is required');
    if (!table?.trim()) throw new BadRequestException('table is required');
    return this.etl.getColumns(schema.trim(), table.trim());
  }

  @Get('preview')
  @ApiOperation({ summary: 'Превью данных таблицы (до 100 строк)' })
  async getPreview(
    @Query('schema') schema: string,
    @Query('table') table: string,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>[]> {
    this.ensureConfigured();
    if (!schema?.trim()) throw new BadRequestException('schema is required');
    if (!table?.trim()) throw new BadRequestException('table is required');
    const limitNum = limit ? parseInt(limit, 10) : 50;
    if (Number.isNaN(limitNum) || limitNum < 1) {
      throw new BadRequestException('limit must be a positive number');
    }
    return this.etl.getPreview(schema.trim(), table.trim(), limitNum);
  }

  @Post('query')
  @ApiOperation({ summary: 'Выполнить только SELECT-запрос (лимит 200 строк)' })
  async runQuery(@Body() body: { sql?: string }): Promise<{ rows: Record<string, unknown>[]; limited: boolean }> {
    this.ensureConfigured();
    if (!body?.sql || typeof body.sql !== 'string') {
      throw new BadRequestException('sql is required');
    }
    try {
      return await this.etl.runQuery(body.sql);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(message);
    }
  }
}
