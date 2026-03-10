import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { Envs } from '../../shared/env.validation-schema';
import { AdminGuard } from './admin.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminContextService } from './admin-context.service';
import { AdminContextInterceptor } from './admin-context.interceptor';
import { EtlExplorerController } from './etl-explorer/etl-explorer.controller';
import { EtlExplorerService } from './etl-explorer/etl-explorer.service';
import { RewardsModule } from '../rewards/rewards.module';
import { TojModule } from '../toj/toj.module';

@Module({
  imports: [
    RewardsModule,
    TojModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) =>
        ({
          secret:
            config.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production',
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRE') ?? '7d',
          },
        }) as JwtModuleOptions,
    }),
  ],
  controllers: [AdminController, AdminAuthController, EtlExplorerController],
  providers: [AdminGuard, AdminContextService, AdminContextInterceptor, AdminService, AdminAuthService, EtlExplorerService],
  exports: [AdminService],
})
export class AdminModule {}
