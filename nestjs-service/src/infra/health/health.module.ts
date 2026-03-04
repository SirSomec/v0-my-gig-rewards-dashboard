import { Module } from '@nestjs/common';
import { HealthCheckService } from './health-check.service';
import { HealthModule as CoreHealthModule } from '@mygigtechnologies/healthcheck';

@Module({
  imports: [
    CoreHealthModule.forRootAsync({
      inject: [HealthCheckService],
      useFactory: (healthCheckService: HealthCheckService) =>
        healthCheckService.createHealthOptions(),
    }),
  ],
})
export class HealthModule {}
