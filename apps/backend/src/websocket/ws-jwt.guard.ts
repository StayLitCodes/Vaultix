import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';
import { WsException } from '@nestjs/websockets';

interface JwtPayload {
  sub: string;
  walletAddress: string;
  type: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user: {
      userId: string;
      walletAddress: string;
    };
  };
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client: AuthenticatedSocket = context.switchToWs().getClient();

    const token = this.extractTokenFromHandshake(client);

    if (!token) {
      this.logger.warn(
        `WebSocket connection rejected: No token provided. Socket ID: ${client.id}`,
      );
      throw new WsException('Authentication token required');
    }

    try {
      const secret = this.configService.get<string>(
        'JWT_SECRET',
        'your-secret-key-change-in-production',
      );

      const payload = this.jwtService.verify<JwtPayload>(token, { secret });

      if (payload.type !== 'access') {
        this.logger.warn(
          `WebSocket connection rejected: Invalid token type. Socket ID: ${client.id}`,
        );
        throw new WsException('Invalid token type');
      }

      // Attach user info to socket data for later use
      client.data.user = {
        userId: payload.sub,
        walletAddress: payload.walletAddress,
      };

      this.logger.debug(
        `WebSocket authenticated: userId=${payload.sub}, socketId=${client.id}`,
      );

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `WebSocket connection rejected: Invalid token. Error: ${errorMessage}. Socket ID: ${client.id}`,
      );
      throw new WsException('Invalid or expired token');
    }
  }

  private extractTokenFromHandshake(client: Socket): string | null {
    // Try authorization header first
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const tokenFromQuery = client.handshake.query.token;
    if (typeof tokenFromQuery === 'string' && tokenFromQuery) {
      return tokenFromQuery;
    }

    // Try auth object in handshake
    const auth = client.handshake.auth;
    if (auth?.token && typeof auth.token === 'string') {
      return auth.token;
    }

    return null;
  }
}
