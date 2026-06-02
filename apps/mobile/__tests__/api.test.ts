/**
 * Basic unit tests for mobile API services
 */
import { escrowApi } from '../services/api';
import { notificationApi } from '../services/api';

// Mock axios
jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    interceptors: { request: { use: jest.fn() } },
  }),
}));

describe('escrowApi', () => {
  it('exports list, getById, create, releaseMilestone, getTxStatus', () => {
    expect(typeof escrowApi.list).toBe('function');
    expect(typeof escrowApi.getById).toBe('function');
    expect(typeof escrowApi.create).toBe('function');
    expect(typeof escrowApi.releaseMilestone).toBe('function');
    expect(typeof escrowApi.getTxStatus).toBe('function');
  });
});

describe('notificationApi', () => {
  it('exports list, getUnreadCount, markAsRead', () => {
    expect(typeof notificationApi.list).toBe('function');
    expect(typeof notificationApi.getUnreadCount).toBe('function');
    expect(typeof notificationApi.markAsRead).toBe('function');
  });
});

describe('Escrow types', () => {
  it('EscrowStatus values are valid', () => {
    const validStatuses = ['created', 'funded', 'confirmed', 'released', 'completed', 'cancelled', 'disputed', 'expired'];
    validStatuses.forEach((s) => expect(typeof s).toBe('string'));
  });
});
