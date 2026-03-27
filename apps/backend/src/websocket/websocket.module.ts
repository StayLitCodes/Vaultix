import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsGateway } from './events.gateway';
import { WebSocketEventsService } from './websocket-events.service';
import { WsJwtGuard } from './ws-jwt.guard';

@Global()
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'your-secret-key-change-in-production',
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EventsGateway, WebSocketEventsService, WsJwtGuard],
  exports: [WebSocketEventsService, WsJwtGuard],
})
export class WebSocketModule {}
