import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User, KycStatus } from '../../user/entities/user.entity';

export { KycStatus } from '../../user/entities/user.entity';

export enum KycProvider {
  MOCK = 'mock',
  PERSONA = 'persona',
  SUMSUB = 'sumsub',
  ONFIDO = 'onfido',
}

@Entity('kyc_verifications')
@Index('idx_kyc_user', ['userId'])
@Index('idx_kyc_provider_status', ['provider', 'status'])
export class KycVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({
    type: 'varchar',
    default: KycProvider.MOCK,
  })
  provider!: KycProvider;

  @Column({ type: 'varchar', nullable: true })
  providerVerificationId?: string;

  @Column({
    type: 'varchar',
    default: KycStatus.PENDING,
  })
  status!: KycStatus;

  @Column({ type: 'varchar', nullable: true })
  rejectionReason?: string;

  @Column({ type: 'simple-json', nullable: true })
  providerMetadata?: Record<string, unknown>;

  @Column({ type: 'datetime', nullable: true })
  initiatedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
