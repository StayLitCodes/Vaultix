import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { PreferenceService } from './preference.service';
import { EmailSender } from './senders/email.sender';
import { WebhookSender } from './senders/webhook.sender';
import { NotificationStatus, NotificationChannel } from './enums/notification-event.enum';

describe('NotificationService', () => {
  let service: NotificationService;
  let repoMock: any;
  let preferenceServiceMock: any;
  let emailSenderMock: any;
  let webhookSenderMock: any;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    };

    preferenceServiceMock = {
      getUserPreferences: jest.fn(),
    };

    emailSenderMock = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    webhookSenderMock = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: repoMock,
        },
        {
          provide: PreferenceService,
          useValue: preferenceServiceMock,
        },
        {
          provide: EmailSender,
          useValue: emailSenderMock,
        },
        {
          provide: WebhookSender,
          useValue: webhookSenderMock,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processPendingNotifications', () => {
    it('should process pending notifications and mark them as SENT', async () => {
      const mockNotifications = [
        { id: '1', userId: 'user1', status: NotificationStatus.PENDING, eventType: 'test' },
      ];
      repoMock.find.mockResolvedValue(mockNotifications);
      preferenceServiceMock.getUserPreferences.mockResolvedValue([
        { enabled: true, channel: NotificationChannel.EMAIL, eventTypes: ['test'] },
      ]);

      await service.processPendingNotifications();

      expect(repoMock.find).toHaveBeenCalled();
      expect(emailSenderMock.send).toHaveBeenCalled();
      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        status: NotificationStatus.SENT,
      }));
    });

    it('should handle retries and mark as FAILED after 3 retries', async () => {
      const mockNotification = {
        id: '1',
        userId: 'user1',
        status: NotificationStatus.PENDING,
        eventType: 'test',
        retryCount: 2,
      };
      repoMock.find.mockResolvedValue([mockNotification]);
      preferenceServiceMock.getUserPreferences.mockResolvedValue([
        { enabled: true, channel: NotificationChannel.EMAIL, eventTypes: ['test'] },
      ]);
      emailSenderMock.send.mockRejectedValue(new Error('Send failed'));

      await service.processPendingNotifications();

      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        status: NotificationStatus.FAILED,
        retryCount: 3,
      }));
    });

    it('should increment retry count if failed but less than 3 retries', async () => {
      const mockNotification = {
        id: '1',
        userId: 'user1',
        status: NotificationStatus.PENDING,
        eventType: 'test',
        retryCount: 0,
      };
      repoMock.find.mockResolvedValue([mockNotification]);
      preferenceServiceMock.getUserPreferences.mockResolvedValue([
        { enabled: true, channel: NotificationChannel.EMAIL, eventTypes: ['test'] },
      ]);
      emailSenderMock.send.mockRejectedValue(new Error('Send failed'));

      await service.processPendingNotifications();

      expect(repoMock.save).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        status: NotificationStatus.PENDING,
        retryCount: 1,
      }));
    });
  });

  describe('getQueueDepth', () => {
    it('should return the count of pending notifications', async () => {
      repoMock.count.mockResolvedValue(10);
      const depth = await service.getQueueDepth();
      expect(depth).toBe(10);
      expect(repoMock.count).toHaveBeenCalledWith({
        where: { status: NotificationStatus.PENDING },
      });
    });
  });
});
