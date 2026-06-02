import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notifications.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { PreferenceService } from './preference.service';
import { EmailSender } from './senders/email.sender';
import { WebhookSender } from './senders/webhook.sender';
import {
  NotificationStatus,
  NotificationChannel,
  NotificationEventType,
} from './enums/notification-event.enum';
import { Repository } from 'typeorm';

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: jest.Mocked<Repository<Notification>>;
  let preferenceService: jest.Mocked<PreferenceService>;
  let emailSender: jest.Mocked<EmailSender>;
  let webhookSender: jest.Mocked<WebhookSender>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: PreferenceService,
          useValue: {
            getUserPreferences: jest.fn(),
          },
        },
        {
          provide: EmailSender,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: WebhookSender,
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    repo = module.get(getRepositoryToken(Notification));
    preferenceService = module.get(PreferenceService);
    emailSender = module.get(EmailSender);
    webhookSender = module.get(WebhookSender);
  });

  const mockPref = {
    userId: 'u1',
    channel: NotificationChannel.EMAIL,
    enabled: true,
    eventTypes: [NotificationEventType.ESCROW_CREATED],
  };

  const mockNotification = {
    id: 'n1',
    userId: 'u1',
    eventType: NotificationEventType.ESCROW_CREATED,
    payload: { escrowId: 'e1' },
    status: NotificationStatus.PENDING,
    retryCount: 0,
    readAt: null as Date | null,
    save: jest.fn(),
  };

  describe('handleEscrowEvent', () => {
    it('should create notification if preferences enabled', async () => {
      preferenceService.getUserPreferences.mockResolvedValue([mockPref] as any);
      repo.create.mockReturnValue(mockNotification as any);

      await service.handleEscrowEvent(
        'u1',
        NotificationEventType.ESCROW_CREATED,
        { escrowId: 'e1' },
      );

      expect(repo.save).toHaveBeenCalled();
    });

    it('should skip if preference disabled', async () => {
      preferenceService.getUserPreferences.mockResolvedValue([
        { ...mockPref, enabled: false },
      ] as any);

      await service.handleEscrowEvent(
        'u1',
        NotificationEventType.ESCROW_CREATED,
        { escrowId: 'e1' },
      );

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('processPendingNotifications', () => {
    it('should process pending notifications and mark as sent', async () => {
      repo.find.mockResolvedValue([mockNotification] as any);
      preferenceService.getUserPreferences.mockResolvedValue([mockPref] as any);
      emailSender.send.mockResolvedValue();

      await service.processPendingNotifications();

      expect(emailSender.send).toHaveBeenCalledWith(mockNotification);
      expect(mockNotification.status).toBe(NotificationStatus.SENT);
      expect(repo.save).toHaveBeenCalledWith(mockNotification);
    });

    it('should increment retryCount on failure', async () => {
      repo.find.mockResolvedValue([mockNotification] as any);
      preferenceService.getUserPreferences.mockResolvedValue([mockPref] as any);
      emailSender.send.mockRejectedValue(new Error('Send error'));

      await service.processPendingNotifications();

      expect(mockNotification.retryCount).toBe(1);
      expect(mockNotification.status).toBe(NotificationStatus.PENDING);
    });

    it('should mark as failed if retry count exceeded', async () => {
      const failingNotification = { ...mockNotification, retryCount: 4 };
      repo.find.mockResolvedValue([failingNotification] as any);
      preferenceService.getUserPreferences.mockResolvedValue([mockPref] as any);
      emailSender.send.mockRejectedValue(new Error('Send error'));

      await service.processPendingNotifications();

      expect(failingNotification.status).toBe(NotificationStatus.FAILED);
    });
  });

  describe('markAsRead', () => {
    it('should mark single notification as read', async () => {
      repo.findOne.mockResolvedValue(mockNotification as any);
      await service.markAsRead('u1', 'n1');
      expect(mockNotification.readAt).toBeDefined();
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw if notification not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markAsRead('u1', 'n1')).rejects.toThrow();
    });

    it('should mark all as read if no id provided', async () => {
      await service.markAsRead('u1');
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return count', async () => {
      repo.count.mockResolvedValue(5);
      const result = await service.getUnreadCount('u1');
      expect(result).toBe(5);
    });
  });
});
