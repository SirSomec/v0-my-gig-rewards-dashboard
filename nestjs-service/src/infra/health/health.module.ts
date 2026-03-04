import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { DrizzleModule } from '../db/drizzle/drizzle.module';
import { DrizzleHealthIndicator } from './drizzle.health';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, DrizzleModule],
  controllers: [HealthController],
  providers: [DrizzleHealthIndicator],
})
export class HealthModule {}
