import { Test, TestingModule } from '@nestjs/testing';
import { PreferenceService } from './preference.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Repository } from 'typeorm';
import { NotificationChannel } from './enums/notification-event.enum';
import { NotificationEventType } from './enums/notification-event.enum';

describe('PreferenceService', () => {
  let service: PreferenceService;
  let repo: jest.Mocked<Repository<NotificationPreference>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferenceService,
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PreferenceService>(PreferenceService);
    repo = module.get(getRepositoryToken(NotificationPreference));
  });

  const mockPref = {
    userId: 'u1',
    channel: NotificationChannel.EMAIL,
    enabled: true,
    eventTypes: [],
  };

  describe('getUserPreferences', () => {
    it('should return preferences for a user', async () => {
      repo.find.mockResolvedValue([mockPref] as any);
      const result = await service.getUserPreferences('u1');
      expect(repo.find).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(result).toEqual([mockPref]);
    });
  });

  describe('seedDefaultPreferences', () => {
    it('should create defaults for every channel when none exist', async () => {
      repo.find.mockResolvedValue([]);
      repo.create.mockImplementation((data: any) => data);
      repo.save.mockImplementation((data: any) => Promise.resolve(data));

      const result = await service.seedDefaultPreferences('u1');

      const channels = Object.values(NotificationChannel);
      expect(repo.create).toHaveBeenCalledTimes(channels.length);
      expect(result).toHaveLength(channels.length);

      for (const pref of result) {
        expect(pref.userId).toBe('u1');
        expect(pref.enabled).toBe(true);
        expect(pref.eventTypes).toEqual(
          expect.arrayContaining(Object.values(NotificationEventType)),
        );
      }
    });

    it('should be idempotent and keep existing preferences', async () => {
      repo.find.mockResolvedValue([mockPref] as any);

      const result = await service.seedDefaultPreferences('u1');

      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(result).toEqual([mockPref]);
    });
  });

  describe('updatePreferences', () => {
    it('should create new preference if not exists', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockPref as any);
      repo.save.mockResolvedValue(mockPref as any);

      const updates = [
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [] },
      ];
      const result = await service.updatePreferences('u1', updates as any);

      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual([mockPref]);
    });

    it('should update existing preference', async () => {
      const existing = { ...mockPref, enabled: false };
      repo.findOne.mockResolvedValue(existing as any);
      repo.save.mockResolvedValue({ ...existing, enabled: true } as any);

      const updates = [
        { channel: NotificationChannel.EMAIL, enabled: true, eventTypes: [] },
      ];
      const result = await service.updatePreferences('u1', updates as any);

      expect(repo.save).toHaveBeenCalled();
      expect(result[0].enabled).toBe(true);
    });
  });
});
