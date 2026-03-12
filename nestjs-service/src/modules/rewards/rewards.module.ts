import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { RewardsRepository } from './rewards.repository';
import { TojModule } from '../toj/toj.module';

@Module({
  imports: [ConfigModule, forwardRef(() => TojModule)],
  controllers: [RewardsController],
  providers: [RewardsRepository, RewardsService],
  exports: [RewardsService],
})
export class RewardsModule {}
