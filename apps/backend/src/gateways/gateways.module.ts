import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EscrowGateway } from './escrow.gateway';

@Module({
  imports: [JwtModule],
  providers: [EscrowGateway],
  exports: [EscrowGateway],
})
export class GatewaysModule {}
