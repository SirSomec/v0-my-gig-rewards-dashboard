import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Envs } from '../../shared/env.validation-schema';

/** Только для разработки: вход под пользователем по userId без пароля. */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthDevController {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Envs, true>,
  ) {}

  @Post('dev-login')
  @ApiOperation({
    summary: '[Dev] Вход под пользователем по ID (без пароля). Доступно только при NODE_ENV !== production или при заданном DEV_USER_ID.',
  })
  devLogin(@Body() body: { userId?: number }): { accessToken: string } {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const devUserId = this.config.get<string>('DEV_USER_ID');
    if (nodeEnv === 'production' && !devUserId) {
      throw new ForbiddenException('Dev login is disabled in production');
    }
    const userId = body?.userId;
    if (userId == null || typeof userId !== 'number') {
      throw new BadRequestException('body.userId (number) is required');
    }
    const secret =
      this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production';
    const expire = this.config.get<string>('JWT_EXPIRE') ?? '7d';
    const accessToken = this.jwt.sign(
      { sub: userId },
      { secret, expiresIn: expire },
    );
    return { accessToken };
  }
}
