import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EtlExplorerController } from './etl-explorer/etl-explorer.controller';
import { EtlExplorerService } from './etl-explorer/etl-explorer.service';
import { RewardsModule } from '../rewards/rewards.module';
import { TojModule } from '../toj/toj.module';

@Module({
  imports: [RewardsModule, TojModule],
  controllers: [AdminController, EtlExplorerController],
  providers: [AdminService, EtlExplorerService],
  exports: [AdminService],
})
export class AdminModule {}
