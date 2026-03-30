import { RewardsService } from './rewards.service';

describe('RewardsService monthly retention', () => {
  const createService = () => {
    const rewardsRepository = {
      getUserWithCurrentLevel: jest.fn(),
      countUserShiftTransactionsInRange: jest.fn(),
      findLevelByShiftsRequired: jest.fn(),
      getBaseLevel: jest.fn(),
      updateUserLevelAndShifts: jest.fn(),
      getSystemSettingValue: jest.fn(),
      listUsersWithCurrentLevel: jest.fn(),
      upsertSystemSettingValue: jest.fn(),
    } as unknown as ConstructorParameters<typeof RewardsService>[0];

    const config = {} as ConstructorParameters<typeof RewardsService>[1];
    const service = new RewardsService(rewardsRepository, config);
    return { service, rewardsRepository: rewardsRepository as any };
  };

  it('не понижает уровень, если порог удержания не задан', async () => {
    const { service, rewardsRepository } = createService();
    rewardsRepository.getUserWithCurrentLevel.mockResolvedValue({
      user: { id: 10 },
      currentLevel: { id: 3, sortOrder: 2, monthlyShiftsRequiredToKeep: null },
    });

    await service.recalcUserLevelByMonthlyRetention(10, new Date('2026-02-01T00:00:00.000Z'));

    expect(rewardsRepository.updateUserLevelAndShifts).not.toHaveBeenCalled();
  });

  it('понижает уровень до соответствующего фактическим сменам за месяц', async () => {
    const { service, rewardsRepository } = createService();
    rewardsRepository.getUserWithCurrentLevel.mockResolvedValue({
      user: { id: 20 },
      currentLevel: { id: 5, sortOrder: 4, monthlyShiftsRequiredToKeep: 12 },
    });
    rewardsRepository.countUserShiftTransactionsInRange.mockResolvedValue(3);
    rewardsRepository.findLevelByShiftsRequired.mockResolvedValue({
      id: 2,
      sortOrder: 1,
    });

    await service.recalcUserLevelByMonthlyRetention(20, new Date('2026-02-01T00:00:00.000Z'));

    expect(rewardsRepository.updateUserLevelAndShifts).toHaveBeenCalledWith(20, 2, 0);
  });

  it('не понижает уровень, если месячный порог выполнен', async () => {
    const { service, rewardsRepository } = createService();
    rewardsRepository.getUserWithCurrentLevel.mockResolvedValue({
      user: { id: 30 },
      currentLevel: { id: 4, sortOrder: 3, monthlyShiftsRequiredToKeep: 6 },
    });
    rewardsRepository.countUserShiftTransactionsInRange.mockResolvedValue(6);

    await service.recalcUserLevelByMonthlyRetention(30, new Date('2026-02-01T00:00:00.000Z'));

    expect(rewardsRepository.updateUserLevelAndShifts).not.toHaveBeenCalled();
  });

  it('processMonthlyRetentionIfNeeded выполняется один раз в месяц', async () => {
    const { service, rewardsRepository } = createService();
    rewardsRepository.getSystemSettingValue.mockResolvedValue('2026-02');

    const first = await service.processMonthlyRetentionIfNeeded(new Date('2026-02-15T10:00:00.000Z'));
    expect(first).toEqual({ processed: false, usersChecked: 0 });

    rewardsRepository.getSystemSettingValue.mockResolvedValue('2026-01');
    rewardsRepository.listUsersWithCurrentLevel.mockResolvedValue([
      { user: { id: 1 } },
      { user: { id: 2 } },
    ]);
    rewardsRepository.getUserWithCurrentLevel.mockImplementation(async (userId: number) => ({
      user: { id: userId },
      currentLevel: { id: 3, sortOrder: 2, monthlyShiftsRequiredToKeep: null },
    }));

    const second = await service.processMonthlyRetentionIfNeeded(new Date('2026-02-15T10:00:00.000Z'));
    expect(second).toEqual({ processed: true, usersChecked: 2 });
    expect(rewardsRepository.upsertSystemSettingValue).toHaveBeenCalled();
  });
});
