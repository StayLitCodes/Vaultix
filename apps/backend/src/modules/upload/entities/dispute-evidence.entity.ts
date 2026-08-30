import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dispute } from '../../escrow/entities/dispute.entity';
import { User } from '../../user/entities/user.entity';

@Entity('dispute_evidence')
export class DisputeEvidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  disputeId: string;

  @ManyToOne(() => Dispute, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'disputeId' })
  dispute: Dispute;

  @Column()
  uploadedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedByUserId' })
  uploadedBy: User;

  @Column({ length: 255 })
  filename: string;

  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 100 })
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ length: 500 })
  storagePath: string;

  @Column({ length: 500, nullable: true })
  thumbnailPath: string | null;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ nullable: true })
  deletedByUserId: string | null;

  @Column({ type: 'datetime', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
