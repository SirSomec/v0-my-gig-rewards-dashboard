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
  SERVICE_USERNAME?: string;
  SERVICE_PASSWORD?: string;
  DOC_RELATIVE_PATH?: string;
  LOG_PRETTY?: string;
  LOG_BODY?: string;
  DEV_USER_ID?: string;
  JWT_SECRET?: string;
  JWT_EXPIRE?: string;
  ADMIN_SECRET?: string;
}

export const EnvValidationSchema = Joi.object<Envs, true>({
  NODE_ENV: Joi.string().default('development').required(),
  PORT: Joi.number().required(),
  // Хотя бы один из DATABASE_URL или PG_CONNECTION нужен для Drizzle
  DATABASE_URL: Joi.string(),
  PG_CONNECTION: Joi.string(),
  MIGRATIONS_PATH: Joi.string(),
  MONGO_CONNECTION: Joi.string(),
  SERVICE_USERNAME: Joi.string(),
  SERVICE_PASSWORD: Joi.string(),
  REDIS_DB: Joi.number(),
  REDIS_HOST: Joi.string(),
  REDIS_PORT: Joi.number(),
  REDIS_PASSWORD: Joi.string(),
  DOC_RELATIVE_PATH: Joi.string(),
  LOG_PRETTY: Joi.string(),
  LOG_BODY: Joi.string(),
  DEV_USER_ID: Joi.string(),
  JWT_SECRET: Joi.string(),
  JWT_EXPIRE: Joi.string(),
  ADMIN_SECRET: Joi.string(),
});
