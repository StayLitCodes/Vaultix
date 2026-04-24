import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionController } from './controllers/transaction.controller';
import { TransactionService } from './services/transaction.service';
import { StellarEvent } from '../stellar/entities/stellar-event.entity';
import { Escrow } from '../escrow/entities/escrow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([StellarEvent, Escrow]),
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
