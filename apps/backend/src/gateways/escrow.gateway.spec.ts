import { EscrowGateway } from './escrow.gateway';

describe('EventsGateway', () => {
  let gateway: EscrowGateway;
  let jwtService: { verify: jest.Mock };

  beforeEach(() => {
    jwtService = {
      verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
    };
    gateway = new EscrowGateway(jwtService as any);
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
});
