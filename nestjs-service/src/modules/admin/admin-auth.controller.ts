import {
  Body,
  Controller,
  Delete,
  BadRequestException,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from './admin.guard';
import { AdminAuthService } from './admin-auth.service';
import type { AdminPermissionKey } from '../../infra/db/drizzle/schemas';

export interface AdminUserRequest extends Request {
  adminUser?: {
    id: number | 'super';
    email: string;
    name: string | null;
    isSuper: boolean;
    permissions: AdminPermissionKey[];
  };
}

function requireAdminUsersPermission(req: AdminUserRequest): void {
  const u = req.adminUser;
  if (!u) throw new Error('AdminGuard must run before permission check');
  if (u.isSuper) return;
  if (!u.permissions.includes('admin_users')) {
    throw new ForbiddenException('Нет прав на управление пользователями админки');
  }
}

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Вход в админ-панель по email и паролю' })
  async login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(
      body.email ?? '',
      body.password ?? '',
    );
  }

  @Get('auth/me')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Текущий пользователь админки (из JWT или X-Admin-Key)' })
  me(@Req() req: AdminUserRequest) {
    return req.adminUser ?? null;
  }

  @Get('admin-users')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Список пользователей админ-панели' })
  listAdminUsers(@Req() req: AdminUserRequest) {
    requireAdminUsersPermission(req);
    return this.auth.listAdminUsers();
  }

  @Post('admin-users')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Создать пользователя админ-панели' })
  createAdminUser(
    @Req() req: AdminUserRequest,
    @Body()
    body: {
      email: string;
      password: string;
      name?: string | null;
      permissions?: AdminPermissionKey[];
    },
  ) {
    requireAdminUsersPermission(req);
    return this.auth.createAdminUser(body);
  }

  @Patch('admin-users/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Обновить пользователя админ-панели' })
  updateAdminUser(
    @Req() req: AdminUserRequest,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string | null;
      isActive?: number;
      permissions?: AdminPermissionKey[];
      password?: string | null;
    },
  ) {
    requireAdminUsersPermission(req);
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new BadRequestException('Invalid id');
    return this.auth.updateAdminUser(numId, body);
  }

  @Delete('admin-users/:id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Удалить пользователя админ-панели' })
  deleteAdminUser(@Req() req: AdminUserRequest, @Param('id') id: string) {
    requireAdminUsersPermission(req);
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) throw new BadRequestException('Invalid id');
    return this.auth.deleteAdminUser(numId);
  }
}
