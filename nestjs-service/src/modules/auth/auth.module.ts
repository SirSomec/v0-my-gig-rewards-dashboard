import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Envs } from '../../shared/env.validation-schema';
import { BasicAuthStrategy } from './basic.strategy';
import { JwtStrategy } from './jwt.strategy';
import { InternalSecretGuard } from './internal-secret.guard';
import { AuthDevController } from './auth-dev.controller';
import { AuthEnsureUserController } from './auth-ensure-user.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    PassportModule,
    AdminModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Envs, true>) => ({
        secret:
          config.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRE') ?? '7d',
        },
      } as JwtModuleOptions),
    }),
  ],
  controllers: [AuthDevController, AuthEnsureUserController],
  providers: [BasicAuthStrategy, JwtStrategy, InternalSecretGuard],
})
export class AuthModule {}
