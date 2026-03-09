import * as Joi from 'joi';

export interface Envs {
  NODE_ENV: string;
  PORT: number;
  /** PostgreSQL: задайте DATABASE_URL или PG_CONNECTION (для деплоя только с Drizzle достаточно DATABASE_URL). */
  PG_CONNECTION?: string;
  DATABASE_URL?: string;
  MIGRATIONS_PATH?: string;
  MONGO_CONNECTION?: string;
  REDIS_DB?: number;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  /** ETL (MVP): хост источника данных */
  ETL_HOST?: string;
  ETL_PORT?: string;
  ETL_USER?: string;
  ETL_PASSWORD?: string;
  ETL_DATABASE?: string;
  ETL_SSL_ROOT_CERT?: string;
  /** Мок TOJ: URL сервиса (например http://mock-toj:3010) и ключ для эндпоинта генерации */
  MOCK_TOJ_URL?: string;
  MOCK_TOJ_ADMIN_KEY?: string;
  /** TOJ API: источник смен (боевой или мок). Синхронизация смен из TOJ. */
  TOJ_BASE_URL?: string;
  TOJ_USER?: string;
  TOJ_PASSWORD?: string;
  TOJ_SYNC_ENABLED?: string;
  TOJ_SYNC_MAX_JOBS_PER_RUN?: number;
  TOJ_SYNC_INITIAL_DAYS_AGO?: number;
  TOJ_SYNC_WORKER_BATCH_SIZE?: number;
  TOJ_SYNC_PAGE_SIZE?: number;
  SERVICE_USERNAME?: string;
  SERVICE_PASSWORD?: string;
  DOC_RELATIVE_PATH?: string;
  LOG_PRETTY?: string;
  LOG_BODY?: string;
  DEV_USER_ID?: string;
  JWT_SECRET?: string;
  JWT_EXPIRE?: string;
  ADMIN_SECRET?: string;
  /** Секрет для вызова ensure-user из Next.js (синхронизация пользователя MyGig при первом входе). */
  REWARDS_INTERNAL_SECRET?: string;
}

export const EnvValidationSchema = Joi.object<Envs, true>({
  NODE_ENV: Joi.string().default('development').required(),
  PORT: Joi.number().required(),
  // Остальные поля опциональны (для деплоя только с Drizzle достаточно DATABASE_URL).
  DATABASE_URL: Joi.string().optional(),
  PG_CONNECTION: Joi.string().optional(),
  MIGRATIONS_PATH: Joi.string().optional(),
  MONGO_CONNECTION: Joi.string().optional(),
  SERVICE_USERNAME: Joi.string().optional(),
  SERVICE_PASSWORD: Joi.string().optional(),
  REDIS_DB: Joi.number().optional(),
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.number().optional(),
  REDIS_PASSWORD: Joi.string().optional(),
  ETL_HOST: Joi.string().optional().allow(''),
  ETL_PORT: Joi.string().optional().allow(''),
  ETL_USER: Joi.string().optional().allow(''),
  ETL_PASSWORD: Joi.string().optional().allow(''),
  ETL_DATABASE: Joi.string().optional().allow(''),
  ETL_SSL_ROOT_CERT: Joi.string().optional().allow(''),
  MOCK_TOJ_URL: Joi.string().optional().allow(''),
  MOCK_TOJ_ADMIN_KEY: Joi.string().optional().allow(''),
  TOJ_BASE_URL: Joi.string().optional().allow(''),
  TOJ_USER: Joi.string().optional().allow(''),
  TOJ_PASSWORD: Joi.string().optional().allow(''),
  TOJ_SYNC_ENABLED: Joi.string().optional().allow(''),
  TOJ_SYNC_MAX_JOBS_PER_RUN: Joi.number().optional(),
  TOJ_SYNC_INITIAL_DAYS_AGO: Joi.number().optional(),
  TOJ_SYNC_WORKER_BATCH_SIZE: Joi.number().optional(),
  TOJ_SYNC_PAGE_SIZE: Joi.number().optional(),
  DOC_RELATIVE_PATH: Joi.string().optional(),
  LOG_PRETTY: Joi.string().optional(),
  LOG_BODY: Joi.string().optional(),
  DEV_USER_ID: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),
  JWT_EXPIRE: Joi.string().optional(),
  ADMIN_SECRET: Joi.string().optional(),
  REWARDS_INTERNAL_SECRET: Joi.string().optional(),
}).unknown(true);
