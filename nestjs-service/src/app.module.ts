import {
  Logger,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleDestroy,
} from '@nestjs/common';
import { RequestLoggerMiddleware } from '@mygigtechnologies/nest-logger';
import { ConfigModule } from '@nestjs/config';
import { EnvValidationSchema } from './shared/env.validation-schema';
import { AuthModule } from './modules/auth/auth.module';
import { DrizzleModule } from './infra/db/drizzle/drizzle.module';
import { MongooseModule } from './infra/db/mongoose/mongoose.module';
import { HealthModule } from './infra/health/health.module';
import { RedisModule } from './infra/db/redis/redis.module';
import { CacheModule } from './infra/cache/cache.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { AdminModule } from './modules/admin/admin.module';

const SHUTDOWN_TIMEOUT = 60000;

@Module({
  imports: [
    AuthModule,
    HealthModule,
    DrizzleModule,
    MongooseModule,
    RedisModule,
    CacheModule,
    RewardsModule,
    AdminModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env.development', '.env'],
      validationSchema: EnvValidationSchema,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule, OnModuleDestroy {
  private readonly logger = new Logger(AppModule.name);

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }

  onModuleDestroy() {
    setTimeout(() => {
      this.logger.warn(
        `Could not close connections in ${
          SHUTDOWN_TIMEOUT / 1000
        }s, forcing shut down`,
        { method: 'onModuleDestroy' },
      );

      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  }
}
