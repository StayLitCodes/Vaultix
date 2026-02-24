import { Module } from '@nestjs/common';
import { EscrowController } from '../modules/escrow/controllers/escrow.controller';
import { EscrowService } from '../modules/escrow/services/escrow.service';

@Module({
  controllers: [EscrowController],
  providers: [EscrowService],
})
export class EscrowModule {}
