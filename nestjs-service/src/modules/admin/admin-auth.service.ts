import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { and, eq } from 'drizzle-orm';
import type { Envs } from '../../shared/env.validation-schema';
import * as schema from '../../infra/db/drizzle/schemas';
import type { AdminPermissionKey } from '../../infra/db/drizzle/schemas';
import { AdminDbRepository } from './admin-db.repository';

const SALT_ROUNDS = 10;

export interface AdminSessionPayload {
  sub: number | 'super';
  email: string;
  isSuper: boolean;
  permissions: AdminPermissionKey[];
  iat?: number;
  exp?: number;
}

export interface AdminUserInfo {
  id: number | 'super';
  email: string;
  name: string | null;
  isSuper: boolean;
  permissions: AdminPermissionKey[];
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly adminDbRepository: AdminDbRepository,
    private readonly config: ConfigService<Envs, true>,
    private readonly jwt: JwtService,
  ) {}

  private get db() {
    return this.adminDbRepository.db;
  }

  /** Проверить суперадмина из .env */
  private checkSuperAdmin(email: string, password: string): boolean {
    const superEmail = this.config.get<string>('ADMIN_SUPER_EMAIL')?.trim();
    const superPassword = this.config.get<string>('ADMIN_SUPER_PASSWORD');
    if (!superEmail || !superPassword) return false;
    return email === superEmail && password === superPassword;
  }

  /** Вход: сначала суперадмин, затем пользователи из БД. Возвращает JWT и данные пользователя. */
  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: AdminUserInfo }> {
    const emailNorm = email?.trim().toLowerCase();
    if (!emailNorm || !password) {
      throw new UnauthorizedException('Email и пароль обязательны');
    }

    if (this.checkSuperAdmin(emailNorm, password)) {
      const payload: AdminSessionPayload = {
        sub: 'super',
        email: emailNorm,
        isSuper: true,
        permissions: [...schema.ADMIN_PERMISSION_KEYS],
      };
      const token = this.jwt.sign({ ...payload });
      return {
        token,
        user: {
          id: 'super',
          email: emailNorm,
          name: null,
          isSuper: true,
          permissions: [...schema.ADMIN_PERMISSION_KEYS],
        },
      };
    }

    const [row] = await this.db
      .select()
      .from(schema.adminPanelUsers)
      .where(
        and(
          eq(schema.adminPanelUsers.email, emailNorm),
          eq(schema.adminPanelUsers.isActive, 1),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const match = await bcrypt.compare(password, row.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const permissions = (row.permissions ?? []) as AdminPermissionKey[];
    const payload: AdminSessionPayload = {
      sub: row.id,
      email: row.email,
      isSuper: false,
      permissions,
    };
    const token = this.jwt.sign({ ...payload });
    return {
      token,
      user: {
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        isSuper: false,
        permissions,
      },
    };
  }

  /** Проверить JWT и вернуть данные сессии (для GET /me). */
  verifyToken(token: string): AdminUserInfo | null {
    try {
      const payload = this.jwt.verify(token) as AdminSessionPayload;
      if (!payload?.sub || !payload?.email) return null;
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.sub === 'super' ? null : null,
        isSuper: payload.isSuper === true,
        permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      };
    } catch {
      return null;
    }
  }

  /** Список пользователей админ-панели (для раздела «Пользователи админки»). */
  async listAdminUsers(): Promise<
    { id: number; email: string; name: string | null; isActive: number; permissions: AdminPermissionKey[] }[]
  > {
    const rows = await this.db
      .select({
        id: schema.adminPanelUsers.id,
        email: schema.adminPanelUsers.email,
        name: schema.adminPanelUsers.name,
        isActive: schema.adminPanelUsers.isActive,
        permissions: schema.adminPanelUsers.permissions,
      })
      .from(schema.adminPanelUsers)
      .orderBy(schema.adminPanelUsers.id);
    return rows.map((r) => ({
      ...r,
      permissions: (r.permissions ?? []) as AdminPermissionKey[],
    }));
  }

  /** Создать пользователя админ-панели. */
  async createAdminUser(params: {
    email: string;
    password: string;
    name?: string | null;
    permissions?: AdminPermissionKey[];
  }): Promise<{ id: number }> {
    const emailNorm = params.email?.trim().toLowerCase();
    if (!emailNorm) throw new BadRequestException('email обязателен');
    if (!params.password || params.password.length < 6) {
      throw new BadRequestException('Пароль не менее 6 символов');
    }

    const [existing] = await this.db
      .select({ id: schema.adminPanelUsers.id })
      .from(schema.adminPanelUsers)
      .where(eq(schema.adminPanelUsers.email, emailNorm))
      .limit(1);
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    const permissions = Array.isArray(params.permissions) ? params.permissions : [];
    const [row] = await this.db
      .insert(schema.adminPanelUsers)
      .values({
        email: emailNorm,
        passwordHash,
        name: params.name?.trim() || null,
        isActive: 1,
        permissions,
      })
      .returning({ id: schema.adminPanelUsers.id });
    if (!row) throw new Error('Insert admin user failed');
    return { id: row.id };
  }

  /** Обновить пользователя админ-панели (имя, активность, права; пароль опционально). */
  async updateAdminUser(
    id: number,
    params: {
      name?: string | null;
      isActive?: number;
      permissions?: AdminPermissionKey[];
      password?: string | null;
    },
  ): Promise<{ id: number }> {
    const [existing] = await this.db
      .select()
      .from(schema.adminPanelUsers)
      .where(eq(schema.adminPanelUsers.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Пользователь не найден');

    const updates: Partial<typeof schema.adminPanelUsers.$inferInsert> = {};
    if (params.name !== undefined) updates.name = params.name?.trim() || null;
    if (params.isActive !== undefined) updates.isActive = params.isActive;
    if (params.permissions !== undefined) updates.permissions = params.permissions;
    if (params.password !== undefined && params.password !== null && params.password !== '') {
      updates.passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
    }
    updates.updatedAt = new Date();

    if (Object.keys(updates).length <= 1) return { id }; // только updatedAt
    await this.db
      .update(schema.adminPanelUsers)
      .set(updates)
      .where(eq(schema.adminPanelUsers.id, id));
    return { id };
  }

  /** Удалить пользователя админ-панели. */
  async deleteAdminUser(id: number): Promise<{ id: number }> {
    const [existing] = await this.db
      .select({ id: schema.adminPanelUsers.id })
      .from(schema.adminPanelUsers)
      .where(eq(schema.adminPanelUsers.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Пользователь не найден');
    await this.db.delete(schema.adminPanelUsers).where(eq(schema.adminPanelUsers.id, id));
    return { id };
  }
}
