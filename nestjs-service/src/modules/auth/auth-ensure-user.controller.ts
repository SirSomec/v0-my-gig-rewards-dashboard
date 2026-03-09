import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Envs } from '../../shared/env.validation-schema';
import { AdminService } from '../admin/admin.service';
import { InternalSecretGuard } from './internal-secret.guard';

/**
 * Синхронизация пользователя при первом входе через MyGig.
 * Вызывается из Next.js API route с заголовком X-Internal-Secret.
 */
@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
@UseGuards(InternalSecretGuard)
export class AuthEnsureUserController {
  constructor(
    private readonly admin: AdminService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Envs, true>,
  ) {}

  @Post('ensure-user')
  @ApiOperation({
    summary: 'Найти или создать пользователя по externalId (MyGig), выдать JWT для дашборда',
  })
  async ensureUser(
    @Body() body: { externalId?: string; name?: string },
  ): Promise<{ accessToken: string }> {
    const externalId = body?.externalId?.trim();
    if (!externalId) {
      throw new BadRequestException('externalId is required');
    }
    const name = body?.name?.trim() ?? '';
    const { id } = await this.admin.ensureUserByExternalId(externalId, name);
    const secret =
      this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-in-production';
    const expire = this.config.get<string>('JWT_EXPIRE') ?? '7d';
    const accessToken = this.jwt.sign(
      { sub: id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JWT sign options
      { secret, expiresIn: expire } as any,
    );
    return { accessToken };
  }
}
