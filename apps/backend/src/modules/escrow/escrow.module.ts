import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { Party } from './entities/party.entity';
import { Condition } from './entities/condition.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { EscrowService } from './services/escrow.service';
import { EscrowController } from './controllers/escrow.controller';
import { EscrowAccessGuard } from './guards/escrow-access.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow, Party, Condition, EscrowEvent]),
    AuthModule,
  ],
  controllers: [EscrowController],
  providers: [EscrowService, EscrowAccessGuard],
  exports: [EscrowService],
})
export class EscrowModule {}
