/* eslint-disable @typescript-eslint/unbound-method */
import { DigestService } from './digest.service';
import { NotificationChannel } from './enums/notification-event.enum';

describe('DigestService', () => {
  const pref: any = {
    userId: 'u1',
    channel: NotificationChannel.EMAIL,
    enabled: true,
    digestEnabled: true,
    eventTypes: ['ESCROW_FUNDED'],
  };
  let notifications: any;
  let preferences: any;
  let users: any;
  let email: any;
  let service: DigestService;

  beforeEach(() => {
    notifications = { find: jest.fn(), update: jest.fn() };
    preferences = { find: jest.fn().mockResolvedValue([pref]) };
    users = { findOne: jest.fn().mockResolvedValue({ email: 'a@b.com' }) };
    email = { sendEmailNow: jest.fn().mockResolvedValue(undefined) };
    service = new DigestService(notifications, preferences, users, email);
  });

  it('batches unread notifications into one email and marks them digested', async () => {
    notifications.find.mockResolvedValue([
      {
        id: 'n1',
        eventType: 'ESCROW_FUNDED',
        payload: {},
        createdAt: new Date(),
      },
      {
        id: 'n2',
        eventType: 'ESCROW_FUNDED',
        payload: { escrowTitle: 'X' },
        createdAt: new Date(),
      },
    ]);

    expect(await service.sendDailyDigests()).toBe(1);
    expect(email.sendEmailNow).toHaveBeenCalledTimes(1);
    expect(email.sendEmailNow.mock.calls[0][1]).toContain('2 unread');
    expect(notifications.update).toHaveBeenCalled();
  });

  it('sends nothing when there are no unread notifications', async () => {
    notifications.find.mockResolvedValue([]);
    expect(await service.sendDailyDigests()).toBe(0);
    expect(email.sendEmailNow).not.toHaveBeenCalled();
  });

  it('skips users without an email address', async () => {
    users.findOne.mockResolvedValue({});
    expect(await service.sendDailyDigests()).toBe(0);
    expect(notifications.find).not.toHaveBeenCalled();
  });

  it('does not mark notifications digested when sending fails', async () => {
    notifications.find.mockResolvedValue([
      {
        id: 'n1',
        eventType: 'ESCROW_FUNDED',
        payload: {},
        createdAt: new Date(),
      },
    ]);
    email.sendEmailNow.mockRejectedValue(new Error('smtp'));
    expect(await service.sendDailyDigests()).toBe(0);
    expect(notifications.update).not.toHaveBeenCalled();
  });
});
