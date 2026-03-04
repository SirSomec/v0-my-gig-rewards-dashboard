import {
  Body,
  Controller,
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

  @Get('redemptions')
  @ApiOperation({ summary: 'Список заявок на обмен (фильтр по статусу)' })
  async listRedemptions(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.listRedemptions(status, limit ? parseInt(limit, 10) : 100);
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

  @Get('store-items')
  @ApiOperation({ summary: 'Список товаров магазина' })
  async listStoreItems() {
    return this.admin.listStoreItems();
  }

  @Get('levels')
  @ApiOperation({ summary: 'Справочник уровней' })
  async listLevels() {
    return this.admin.listLevels();
  }

  @Post('shifts/complete')
  @ApiOperation({ summary: '[Мок] Засчитать смену для пользователя' })
  async recordShift(
    @Body() body: { userId: number; coins: number; title?: string; location?: string },
  ) {
    const { userId, coins, title, location } = body;
    if (userId == null || typeof coins !== 'number') throw new Error('userId and coins required');
    return this.rewards.recordShiftCompleted(userId, coins, title, location);
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
}
