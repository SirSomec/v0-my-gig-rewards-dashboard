import { Module, forwardRef } from '@nestjs/common';
import { TojClientService } from './toj-client.service';
import { TojSyncService } from './toj-sync.service';
import { TojSyncRepository } from './toj-sync.repository';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [forwardRef(() => RewardsModule)],
  providers: [TojClientService, TojSyncRepository, TojSyncService],
  exports: [TojSyncService],
})
export class TojModule {}
