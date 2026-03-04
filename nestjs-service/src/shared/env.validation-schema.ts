import * as Joi from 'joi';

export interface Envs {
  NODE_ENV: string;
  PORT: number;
  PG_CONNECTION: string;
  DATABASE_URL?: string; // для миграций и drizzle; по умолчанию = PG_CONNECTION
  MIGRATIONS_PATH?: string; // путь к папке миграций (для скрипта migrate)
  MONGO_CONNECTION: string;
  REDIS_DB: number;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD: string;
  SERVICE_USERNAME: string;
  SERVICE_PASSWORD: string;
  DOC_RELATIVE_PATH?: string;
  LOG_PRETTY?: string;
  LOG_BODY?: string;
  /** Для разработки: фиксированный ID пользователя, если нет авторизации */
  DEV_USER_ID?: string;
  /** Секрет для подписи JWT (dev-логин и сессии). В dev можно не задавать — будет дефолт. */
  JWT_SECRET?: string;
  /** Время жизни access token (например 7d, 24h). */
  JWT_EXPIRE?: string;
  /** Секрет для доступа к админ-API (заголовок X-Admin-Key). В production обязателен. */
  ADMIN_SECRET?: string;
}

export const EnvValidationSchema = Joi.object<Envs, true>({
  NODE_ENV: Joi.string().default('development').required(),
  PORT: Joi.number().required(),
  MONGO_CONNECTION: Joi.string().required(),
  PG_CONNECTION: Joi.string().required(),
  SERVICE_USERNAME: Joi.string().required(),
  SERVICE_PASSWORD: Joi.string().required(),

  REDIS_DB: Joi.number().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_PASSWORD: Joi.string().required(),

  // optionals
  DATABASE_URL: Joi.string(),
  MIGRATIONS_PATH: Joi.string(),
  DOC_RELATIVE_PATH: Joi.string(),
  LOG_PRETTY: Joi.string(),
  LOG_BODY: Joi.string(),
  DEV_USER_ID: Joi.string(),
  JWT_SECRET: Joi.string(),
  JWT_EXPIRE: Joi.string(),
  ADMIN_SECRET: Joi.string(),
});
