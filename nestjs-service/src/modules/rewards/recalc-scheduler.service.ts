import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RewardsService } from './rewards.service';

@Injectable()
export class RecalcSchedulerService {
  private readonly logger = new Logger(RecalcSchedulerService.name);
  private running = false;

  constructor(private readonly rewards: RewardsService) {}

  @Interval(60 * 1000)
  async handlePendingRecalc(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.rewards.processMonthlyRetentionIfNeeded();
      const result = await this.rewards.processPendingRecalcQueue();
      if (result.failedUsers > 0) {
        this.logger.warn(
          `Pending recalc finished with failures: claimed=${result.claimed}, processedUsers=${result.processedUsers}, failedUsers=${result.failedUsers}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Pending recalc scheduler failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
