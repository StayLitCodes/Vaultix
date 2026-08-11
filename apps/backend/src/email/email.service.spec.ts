import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from './email.service';
import { EmailOutbox, EmailOutboxStatus } from './entities/email-outbox.entity';

const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let repo: jest.Mocked<Repository<EmailOutbox>>;

  const configValues: Record<string, unknown> = {
    'email.host': 'smtp.example.com',
    'email.port': 587,
    'email.user': 'user',
    'email.pass': 'pass',
    'email.from': 'no-reply@vaultix.io',
    'email.maxAttempts': 3,
    'email.retryBaseDelayMs': 1000,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: getRepositoryToken(EmailOutbox),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: unknown) =>
                configValues[key] ?? defaultValue,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    repo = module.get(getRepositoryToken(EmailOutbox));
  });

  it('should be defined and configured', () => {
    expect(service).toBeDefined();
    expect(service.isConfigured).toBe(true);
  });

  describe('sendEmail', () => {
    it('should enqueue a pending outbox record without sending', async () => {
      repo.create.mockImplementation((input) => input as EmailOutbox);
      repo.save.mockImplementation((input) =>
        Promise.resolve(input as EmailOutbox),
      );

      const result = await service.sendEmail(
        'to@example.com',
        'Subject',
        '<p>Hello</p>',
        'Hello',
      );

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'to@example.com',
          subject: 'Subject',
          status: EmailOutboxStatus.PENDING,
          attempts: 0,
        }),
      );
      expect(result.status).toBe(EmailOutboxStatus.PENDING);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendEmailNow', () => {
    it('should send directly via the transporter', async () => {
      mockSendMail.mockResolvedValue({});

      await service.sendEmailNow(
        'to@example.com',
        'Subject',
        '<p>Hello</p>',
        'Hello',
      );

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'no-reply@vaultix.io',
        to: 'to@example.com',
        subject: 'Subject',
        text: 'Hello',
        html: '<p>Hello</p>',
      });
    });
  });

  describe('processOutbox', () => {
    const pendingEmail = (): EmailOutbox =>
      ({
        id: 'e1',
        to: 'to@example.com',
        subject: 'Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
        status: EmailOutboxStatus.PENDING,
        attempts: 0,
      }) as EmailOutbox;

    it('should send pending emails and mark them as sent', async () => {
      const email = pendingEmail();
      repo.find.mockResolvedValue([email]);
      mockSendMail.mockResolvedValue({});

      await service.processOutbox();

      expect(mockSendMail).toHaveBeenCalled();
      expect(email.status).toBe(EmailOutboxStatus.SENT);
      expect(email.sentAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalledWith(email);
    });

    it('should schedule a retry with backoff on failure', async () => {
      const email = pendingEmail();
      repo.find.mockResolvedValue([email]);
      mockSendMail.mockRejectedValue(new Error('SMTP down'));

      await service.processOutbox();

      expect(email.attempts).toBe(1);
      expect(email.status).toBe(EmailOutboxStatus.PENDING);
      expect(email.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
      expect(email.lastError).toBe('SMTP down');
    });

    it('should mark as failed once max attempts are reached', async () => {
      const email = pendingEmail();
      email.attempts = 2; // maxAttempts is 3
      repo.find.mockResolvedValue([email]);
      mockSendMail.mockRejectedValue(new Error('SMTP down'));

      await service.processOutbox();

      expect(email.attempts).toBe(3);
      expect(email.status).toBe(EmailOutboxStatus.FAILED);
    });
  });

  describe('checkHealth', () => {
    it('should return true when the transporter verifies', async () => {
      mockVerify.mockResolvedValue(true);
      await expect(service.checkHealth()).resolves.toBe(true);
    });

    it('should return false when verification fails', async () => {
      mockVerify.mockRejectedValue(new Error('connection refused'));
      await expect(service.checkHealth()).resolves.toBe(false);
    });
  });
});
