import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt.guard';
import { RewardsService } from './rewards.service';
import { CreateRedemptionRequestDto } from './dto/store.dto';
import { RecordShiftCompleteRequestDto, RegisterStrikeRequestDto } from './dto/shifts.dto';
import { MeResponseDto } from './dto/me.dto';
import { TransactionResponseDto } from './dto/transaction.dto';
import { StrikeResponseDto } from './dto/strike.dto';
import { QuestResponseDto } from './dto/quest.dto';
import { ReliabilityRatingLogResponseDto } from './dto/reliability-rating-log.dto';
import { StoreItemResponseDto, UserRedemptionResponseDto } from './dto/store.dto';
import { LevelResponseDto } from './dto/level.dto';
import {
  MyRaffleEntryResponseDto,
  PurchaseRaffleTicketsRequestDto,
  PurchaseRaffleTicketsResponseDto,
  RaffleDetailResponseDto,
  RaffleListItemResponseDto,
} from './dto/raffle.dto';

interface RequestWithUser extends Request {
  user?: { userId: number };
}

@ApiTags('dashboard')
@Controller({ path: 'rewards', version: '1' })
@UseGuards(OptionalJwtAuthGuard)
export class RewardsController {
  constructor(private readonly rewards: RewardsService) {}

  private getUserId(req: RequestWithUser, userIdQuery?: string): number {
    return this.rewards.resolveCurrentUserId(
      req.user?.userId,
      userIdQuery,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Текущий пользователь: профиль, баланс, уровень, штрафы за неделю/месяц' })
  async getMe(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<MeResponseDto> {
    const id = this.getUserId(req, userId);
    return this.rewards.getMe(id);
  }

  @Post('loyalty/request')
  @ApiOperation({ summary: 'Отправить заявку на участие (принять условия и нажать «Зарегистрироваться»)' })
  async submitLoyaltyRequest(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<{ accepted: boolean }> {
    const id = this.getUserId(req, userId);
    return this.rewards.submitLoyaltyRequest(id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'История транзакций пользователя' })
  async getTransactions(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<TransactionResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getTransactions(id, limit ? parseInt(limit, 10) : 50);
  }

  @Get('strikes')
  @ApiOperation({ summary: 'История штрафов пользователя (с привязкой к смене shift_external_id)' })
  async getStrikes(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<StrikeResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getStrikes(id, limit ? parseInt(limit, 10) : 50);
  }

  @Get('reliability-rating-log')
  @ApiOperation({ summary: 'История изменений рейтинга надёжности пользователя' })
  async getReliabilityRatingLog(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<ReliabilityRatingLogResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getReliabilityRatingLog(id, limit ? parseInt(limit, 10) : 10);
  }

  @Get('quests')
  @ApiOperation({ summary: 'Квесты с прогрессом за текущий период' })
  async getQuests(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<QuestResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getQuests(id);
  }

  @Get('store')
  @ApiOperation({ summary: 'Каталог товаров магазина' })
  async getStore(): Promise<StoreItemResponseDto[]> {
    return this.rewards.getStoreItems();
  }

  @Get('redemptions')
  @ApiOperation({ summary: 'Мои покупки: список заявок на обмен со статусами' })
  async getRedemptions(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<UserRedemptionResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getUserRedemptions(id);
  }

  @Get('levels')
  @ApiOperation({ summary: 'Список уровней лояльности (название, порог смен, перки)' })
  async getLevels(): Promise<LevelResponseDto[]> {
    return this.rewards.getLevels();
  }

  @Get('raffles')
  @ApiOperation({ summary: 'Список розыгрышей с моими билетами и победителями' })
  async getRaffles(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<RaffleListItemResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getRaffles(id);
  }

  @Get('raffles/:id')
  @ApiOperation({ summary: 'Детали розыгрыша' })
  async getRaffleById(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string | undefined,
    @Param('id') raffleIdParam: string,
  ): Promise<RaffleDetailResponseDto> {
    const id = this.getUserId(req, userId);
    const raffleId = parseInt(raffleIdParam, 10);
    if (Number.isNaN(raffleId)) throw new Error('Invalid raffle id');
    return this.rewards.getRaffleById(id, raffleId);
  }

  @Get('my-raffles')
  @ApiOperation({ summary: 'Мои участия в розыгрышах' })
  async getMyRaffles(
    @Req() req: RequestWithUser,
    @Query('userId') userId?: string,
  ): Promise<MyRaffleEntryResponseDto[]> {
    const id = this.getUserId(req, userId);
    return this.rewards.getMyRaffleEntries(id);
  }

  @Post('raffles/:id/tickets')
  @ApiOperation({ summary: 'Купить билеты в розыгрыш за монеты' })
  async purchaseRaffleTickets(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string | undefined,
    @Param('id') raffleIdParam: string,
    @Body() body: PurchaseRaffleTicketsRequestDto,
  ): Promise<PurchaseRaffleTicketsResponseDto> {
    const id = this.getUserId(req, userId);
    const raffleId = parseInt(raffleIdParam, 10);
    if (Number.isNaN(raffleId)) throw new Error('Invalid raffle id');
    if (body?.quantity == null || typeof body.quantity !== 'number') {
      throw new Error('quantity is required');
    }
    return this.rewards.purchaseRaffleTickets(id, raffleId, body.quantity);
  }

  @Post('redemptions')
  @ApiOperation({ summary: 'Создать заявку на обмен (купить товар за монеты)' })
  async createRedemption(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string | undefined,
    @Body() body: CreateRedemptionRequestDto,
  ): Promise<{ redemptionId: number }> {
    const id = this.getUserId(req, userId);
    const storeItemId = body?.storeItemId;
    if (storeItemId == null || typeof storeItemId !== 'number') {
      throw new Error('storeItemId is required');
    }
    return this.rewards.createRedemption(id, storeItemId);
  }

  @Post('page-view')
  @ApiOperation({ summary: 'Записать просмотр вкладки/страницы (для аналитики посещаемости)' })
  async recordPageView(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string | undefined,
    @Body() body: { path?: string },
  ): Promise<void> {
    const id = this.getUserId(req, userId);
    const path = body?.path?.trim()?.slice(0, 128) || 'home';
    await this.rewards.recordPageView(id, path);
  }

  @Post('shifts/complete')
  @ApiOperation({
    summary: '[Dev/Admin] Засчитать завершённую смену: начисление монет, +1 к сменам, пересчёт уровня.',
  })
  async recordShiftComplete(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string | undefined,
    @Body() body: RecordShiftCompleteRequestDto,
  ): Promise<{ transactionId: number }> {
    const id = this.getUserId(req, userId);
    const coins = body?.coins;
    if (coins == null || typeof coins !== 'number' || coins < 0) {
      throw new Error('coins (number >= 0) is required');
    }
    return this.rewards.recordShiftCompleted(
      id,
      coins,
      body.title,
      body.location,
      body.clientId,
      body.category,
      body.hours,
    );
  }

  @Post('strikes')
  @ApiOperation({
    summary: '[Dev/Admin] Зарегистрировать штраф (no_show / late_cancel). При достижении порога — понижение уровня.',
  })
  async registerStrike(
    @Req() req: RequestWithUser,
    @Query('userId') userId: string | undefined,
    @Body() body: RegisterStrikeRequestDto,
  ): Promise<{ strikeId: number; levelDemoted: boolean }> {
    const id = this.getUserId(req, userId);
    const type = body?.type;
    if (type !== 'no_show' && type !== 'late_cancel') {
      throw new Error('type must be "no_show" or "late_cancel"');
    }
    return this.rewards.registerStrike(id, type, body.shiftExternalId);
  }
}
