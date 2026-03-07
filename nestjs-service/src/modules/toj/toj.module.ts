import { Module } from '@nestjs/common';
import { TojClientService } from './toj-client.service';
import { TojSyncService } from './toj-sync.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [RewardsModule],
  providers: [TojClientService, TojSyncService],
  exports: [TojSyncService],
})
export class TojModule {}
