import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Envs } from '../../shared/env.validation-schema';
import { BasicAuthStrategy } from './basic.strategy';
import { JwtStrategy } from './jwt.strategy';
import { AuthDevController } from './auth-dev.controller';

@Module({
  imports: [
    PassportModule,
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
  controllers: [AuthDevController],
  providers: [BasicAuthStrategy, JwtStrategy],
})
export class AuthModule {}
