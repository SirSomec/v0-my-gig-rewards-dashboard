import { Inject, Injectable } from '@nestjs/common';
import {
  HealthModuleOption,
  InstanceTypes,
} from '@mygigtechnologies/healthcheck';
import { drizzleProvider } from '../db/drizzle/drizzle.module';

@Injectable()
export class HealthCheckService {
  constructor(
    @Inject(drizzleProvider)
    private readonly db: ReturnType<
      typeof import('drizzle-orm/node-postgres').drizzle
    >,
  ) {}

  createHealthOptions(): HealthModuleOption[] {
    return [
      {
        type: InstanceTypes.DRIZZLE,
        active: true,
        instance: this.db,
      },
    ];
  }
}
