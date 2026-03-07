import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { CreateQuestDto, CreateStoreItemDto, UpdateLevelDto, UpdateQuestDto, UpdateStoreItemDto } from './dto/admin.dto';
import { RewardsService } from '../rewards/rewards.service';

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly rewards: RewardsService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Список пользователей (поиск по id, имени, email)' })
  async listUsers(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listUsers(search, limit ? parseInt(limit, 10) : 50);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Карточка пользователя: баланс, уровень, штрафы, транзакции' })
  async getUserDetail(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) throw new Error('Invalid user id');
    return this.admin.getUserDetail(userId);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Ручное изменение уровня пользователя (6.5)' })
  async updateUserLevel(
    @Param('id') id: string,
    @Body() body: { levelId?: number | string },
  ) {
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const raw = body?.levelId;
    if (raw == null) {
      throw new BadRequestException('levelId required');
    }
    const levelId = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    if (Number.isNaN(levelId) || levelId < 1) {
      throw new BadRequestException('levelId must be a positive number');
    }
    return this.admin.updateUserLevel(userId, levelId);
  }

  @Post('users')
  @ApiOperation({ summary: 'Создать пользователя по ID основной системы; имя отображается в личном кабинете' })
  async createUser(
    @Body() body: { externalId: string; name?: string; firstname?: string; lastname?: string },
  ) {
    const { externalId, name, firstname, lastname } = body ?? {};
    let displayName = name?.trim();
    if (displayName === undefined || displayName === '') {
      const fn = (firstname ?? '').trim();
      const ln = (lastname ?? '').trim();
      displayName = [fn, ln].filter(Boolean).join(' ') || '';
    }
    return this.admin.createUser((externalId ?? '').trim(), displayName);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Ручное начисление или списание монет (6.6)' })
  async manualCreditDebit(
    @Body()
    body: {
      userId: number;
      amount: number;
      type: 'manual_credit' | 'manual_debit';
      title?: string;
      description?: string;
    },
  ) {
    const { userId, amount, type, title, description } = body;
    if (userId == null || typeof amount !== 'number' || (type !== 'manual_credit' && type !== 'manual_debit')) {
      throw new Error('userId, amount and type (manual_credit | manual_debit) required');
    }
    return this.admin.manualCreditDebit(userId, amount, type, title, description);
  }

  @Get('redemptions')
  @ApiOperation({ summary: 'Список заявок на обмен с пагинацией и фильтрами' })
  async listRedemptions(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const opts: Parameters<AdminService['listRedemptions']>[0] = {};
    if (status !== undefined) opts.status = status;
    if (search !== undefined) opts.search = search;
    if (dateFrom !== undefined) opts.dateFrom = dateFrom;
    if (dateTo !== undefined) opts.dateTo = dateTo;
    if (page !== undefined) opts.page = parseInt(page, 10);
    if (pageSize !== undefined) opts.pageSize = parseInt(pageSize, 10);
    return this.admin.listRedemptions(opts);
  }

  @Patch('redemptions/:id')
  @ApiOperation({ summary: 'Изменить статус заявки (fulfilled / cancelled), опционально вернуть монеты' })
  async updateRedemption(
    @Param('id') id: string,
    @Body() body: { status: 'fulfilled' | 'cancelled'; notes?: string; returnCoins?: boolean },
  ) {
    const redemptionId = parseInt(id, 10);
    if (Number.isNaN(redemptionId)) throw new Error('Invalid redemption id');
    return this.admin.updateRedemption(
      redemptionId,
      body.status,
      body.notes,
      body.returnCoins ?? false,
    );
  }

  @Post('redemptions/bulk-update')
  @ApiOperation({ summary: 'Массовое изменение статуса заявок (только pending)' })
  async bulkUpdateRedemptions(
    @Body() body: { ids: number[]; status: 'fulfilled' | 'cancelled'; notes?: string; returnCoins?: boolean },
  ) {
    const { ids, status, notes, returnCoins } = body;
    if (!Array.isArray(ids) || ids.length === 0) throw new Error('ids array required');
    return this.admin.bulkUpdateRedemptions(ids, status, notes, returnCoins ?? false);
  }

  @Get('store-items')
  @ApiOperation({ summary: 'Список товаров магазина' })
  async listStoreItems() {
    return this.admin.listStoreItems();
  }

  @Post('store-items')
  @ApiOperation({ summary: 'Создать товар' })
  async createStoreItem(@Body() body: CreateStoreItemDto) {
    if (!body.name || body.category == null || body.cost == null) {
      throw new Error('name, category and cost are required');
    }
    return this.admin.createStoreItem(body);
  }

  @Patch('store-items/:id')
  @ApiOperation({ summary: 'Обновить товар' })
  async updateStoreItem(@Param('id') id: string, @Body() body: UpdateStoreItemDto) {
    const itemId = parseInt(id, 10);
    if (Number.isNaN(itemId)) throw new Error('Invalid store item id');
    return this.admin.updateStoreItem(itemId, body);
  }

  @Delete('store-items/:id')
  @ApiOperation({ summary: 'Удалить товар (мягкое удаление)' })
  async deleteStoreItem(@Param('id') id: string) {
    const itemId = parseInt(id, 10);
    if (Number.isNaN(itemId)) throw new Error('Invalid store item id');
    return this.admin.deleteStoreItem(itemId);
  }

  @Get('levels')
  @ApiOperation({ summary: 'Справочник уровней' })
  async listLevels() {
    return this.admin.listLevels();
  }

  @Get('settings/bonus')
  @ApiOperation({ summary: 'Настройки бонусов за смену: множитель по умолчанию' })
  async getBonusSettings() {
    return this.admin.getBonusSettings();
  }

  @Patch('settings/bonus')
  @ApiOperation({ summary: 'Обновить настройки бонусов за смену (множитель по умолчанию)' })
  async updateBonusSettings(@Body() body: { shiftBonusDefaultMultiplier: number }) {
    if (body.shiftBonusDefaultMultiplier == null || typeof body.shiftBonusDefaultMultiplier !== 'number') {
      throw new Error('shiftBonusDefaultMultiplier required');
    }
    await this.admin.updateBonusSettings(body);
    return this.admin.getBonusSettings();
  }

  @Patch('levels/:id')
  @ApiOperation({ summary: 'Обновить уровень' })
  async updateLevel(@Param('id') id: string, @Body() body: UpdateLevelDto) {
    const levelId = parseInt(id, 10);
    if (Number.isNaN(levelId)) throw new Error('Invalid level id');
    return this.admin.updateLevel(levelId, body);
  }

  @Get('quests')
  @ApiOperation({ summary: 'Список квестов' })
  async listQuests() {
    return this.admin.listQuests();
  }

  @Post('quests')
  @ApiOperation({ summary: 'Создать квест' })
  async createQuest(@Body() body: CreateQuestDto) {
    if (!body.name || !body.period || !body.conditionType || body.rewardCoins == null) {
      throw new Error('name, period, conditionType and rewardCoins are required');
    }
    return this.admin.createQuest(body);
  }

  @Patch('quests/:id')
  @ApiOperation({ summary: 'Обновить квест' })
  async updateQuest(@Param('id') id: string, @Body() body: UpdateQuestDto) {
    const questId = parseInt(id, 10);
    if (Number.isNaN(questId)) throw new Error('Invalid quest id');
    return this.admin.updateQuest(questId, body);
  }

  @Delete('quests/:id')
  @ApiOperation({ summary: 'Отключить квест (мягкое удаление: isActive=0)' })
  async deleteQuest(@Param('id') id: string) {
    const questId = parseInt(id, 10);
    if (Number.isNaN(questId)) throw new Error('Invalid quest id');
    return this.admin.deleteQuest(questId);
  }

  @Post('shifts/complete')
  @ApiOperation({ summary: '[Мок] Засчитать смену для пользователя. При указании hours бонус считается автоматически.' })
  async recordShift(
    @Body()
    body: {
      userId: number;
      coins?: number;
      title?: string;
      location?: string;
      clientId?: string;
      category?: string;
      hours?: number;
    },
  ) {
    const { userId, hours } = body;
    const coins = body.coins ?? 0;
    if (userId == null) throw new Error('userId required');
    if (hours == null && (typeof coins !== 'number' || coins < 0)) {
      throw new Error('coins required when hours not provided (must be >= 0)');
    }
    return this.rewards.recordShiftCompleted(
      userId,
      coins,
      body.title,
      body.location,
      body.clientId,
      body.category,
      hours,
    );
  }

  @Post('strikes')
  @ApiOperation({ summary: '[Мок] Зарегистрировать штраф' })
  async registerStrike(
    @Body() body: { userId: number; type: 'no_show' | 'late_cancel'; shiftExternalId?: string },
  ) {
    const { userId, type, shiftExternalId } = body;
    if (userId == null || (type !== 'no_show' && type !== 'late_cancel')) {
      throw new Error('userId and type (no_show | late_cancel) required');
    }
    return this.rewards.registerStrike(userId, type, shiftExternalId);
  }

  @Post('strikes/:id/remove')
  @ApiOperation({ summary: 'Снять штраф с указанием причины, пересчёт уровня (6.7)' })
  async removeStrike(@Param('id') id: string, @Body() body: { reason?: string }) {
    const strikeId = parseInt(id, 10);
    if (Number.isNaN(strikeId)) throw new Error('Invalid strike id');
    return this.admin.removeStrike(strikeId, body.reason ?? '');
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Журнал аудита: кто, когда, что изменил (6.9)' })
  async listAuditLog(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    const opts: Parameters<AdminService['listAuditLog']>[0] = {};
    if (page !== undefined) opts.page = parseInt(page, 10);
    if (pageSize !== undefined) opts.pageSize = parseInt(pageSize, 10);
    if (action !== undefined) opts.action = action;
    if (entityType !== undefined) opts.entityType = entityType;
    return this.admin.listAuditLog(opts);
  }
}
