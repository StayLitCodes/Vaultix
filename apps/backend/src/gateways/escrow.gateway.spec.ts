import { EscrowGateway } from './escrow.gateway';

describe('EventsGateway', () => {
  let gateway: EscrowGateway;
  let jwtService: { verify: jest.Mock };
  let eventRepository: { createQueryBuilder: jest.Mock };

  beforeEach(() => {
    jwtService = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
    };
    eventRepository = { createQueryBuilder: jest.fn() };
    gateway = new EscrowGateway(jwtService as any, eventRepository as any);
  });

  it('authenticates a socket and emits a connected event', async () => {
    const client = {
      id: 'socket-1',
      handshake: { auth: { token: 'valid-token' }, headers: {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };

    await gateway.handleConnection(client as any);

    expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
    expect(client.emit).toHaveBeenCalledWith(
      'connected',
      expect.objectContaining({ userId: 'user-1', socketId: 'socket-1' }),
    );
  });

  it('broadcasts escrow and notification events to the correct rooms', () => {
    const emit = jest.fn();
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit }),
    } as any;

    gateway['userSocketMap'].set('user-1', new Set(['socket-1']));

    gateway.broadcastEscrowStatusChanged('esc-1', { status: 'active' });
    gateway.broadcastNotification('user-1', { message: 'new message' });

    expect(gateway.server.to).toHaveBeenCalledWith('escrow:esc-1');
    expect(emit).toHaveBeenCalledWith(
      'escrow.status_changed',
      expect.objectContaining({ escrowId: 'esc-1' }),
    );
    expect(emit).toHaveBeenCalledWith(
      'notification.new',
      expect.objectContaining({ message: 'new message' }),
    );
  });

  it('returns authorized missed events in cursor order on reconnect', async () => {
    const missedEvents = [{ id: 'event-2', cursor: '2' }];
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(missedEvents),
    };
    eventRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    gateway['socketUserMap'].set('socket-1', 'user-1');
    const client = {
      id: 'socket-1',
      emit: jest.fn(),
      join: jest.fn(),
    };

    await gateway.handleReconnect(client as any, {
      escrowIds: ['esc-1'],
      lastCursor: '1',
    });

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(escrow.creatorId = :userId OR party.userId = :userId)',
      { userId: 'user-1' },
    );
    expect(client.emit).toHaveBeenCalledWith(
      'reconnected',
      expect.objectContaining({ missedEvents, latestCursor: '2' }),
    );
  });
});
