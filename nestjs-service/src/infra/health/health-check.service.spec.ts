import { Test } from '@nestjs/testing';
import { HealthCheckService } from './health-check.service';
import { InstanceTypes } from '@mygigtechnologies/healthcheck';
import { drizzleProvider } from '../db/drizzle/drizzle.module';

type Drizzle = ReturnType<typeof import('drizzle-orm/node-postgres').drizzle>;

describe('HealthCheckService', () => {
  let service: HealthCheckService;
  const dbMock = {} as unknown as Drizzle;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthCheckService,
        { provide: drizzleProvider, useValue: dbMock },
      ],
    }).compile();

    service = moduleRef.get(HealthCheckService);
  });

  it('возвращает корректные HealthModuleOption для DRIZZLE', () => {
    const options = service.createHealthOptions();

    expect(Array.isArray(options)).toBe(true);
    expect(options).toHaveLength(1);

    expect(options[0]).toEqual({
      type: InstanceTypes.DRIZZLE,
      active: true,
      instance: dbMock,
    });
  });

  it('каждый вызов возвращает новый массив', () => {
    const a = service.createHealthOptions();
    const b = service.createHealthOptions();
    expect(a).not.toBe(b);
  });
});
