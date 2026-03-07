import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { EtlExplorerController } from './etl-explorer/etl-explorer.controller';
import { EtlExplorerService } from './etl-explorer/etl-explorer.service';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [RewardsModule],
  controllers: [AdminController, EtlExplorerController],
  providers: [AdminService, EtlExplorerService],
})
export class AdminModule {}
