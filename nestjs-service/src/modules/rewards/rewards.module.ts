import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { RewardsRepository } from './rewards.repository';
import { RecalcSchedulerService } from './recalc-scheduler.service';

@Module({
  imports: [ConfigModule],
  controllers: [RewardsController],
  providers: [RewardsRepository, RewardsService, RecalcSchedulerService],
  exports: [RewardsService],
})
export class RewardsModule {}
