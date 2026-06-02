import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Escrow } from './escrow.entity';
import { User } from '../../user/entities/user.entity';

export enum PartyRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  ARBITRATOR = 'arbitrator',
}

export enum PartyStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('escrow_parties')
@Index('idx_escrow_parties_user_role', ['userId', 'role'])
@Index('idx_escrow_parties_escrow_role', ['escrowId', 'role'])
export class Party {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  escrowId: string;

  @ManyToOne(() => Escrow, (escrow) => escrow.parties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'escrowId' })
  escrow: Escrow;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'varchar',
  })
  role: PartyRole;

  @Column({
    type: 'varchar',
    default: PartyStatus.PENDING,
  })
  status: PartyStatus;

  @CreateDateColumn()
  createdAt: Date;
}
