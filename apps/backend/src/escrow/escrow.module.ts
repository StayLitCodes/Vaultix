import { Module } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';

@Module({
  controllers: [EscrowController],
  providers: [EscrowService],
})
export class EscrowModule {}
