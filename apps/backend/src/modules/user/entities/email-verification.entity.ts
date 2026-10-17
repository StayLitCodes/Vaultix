import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('email_verifications')
export class EmailVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ unique: true })
  token!: string;

  /**
   * The address this token was issued for. A token only verifies the user
   * while their current email still equals this value. Nullable for legacy
   * rows issued before tokens were address-bound; those are never accepted.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string | null;

  @Column()
  expiresAt!: Date;

  @Column({ default: false })
  isUsed!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
