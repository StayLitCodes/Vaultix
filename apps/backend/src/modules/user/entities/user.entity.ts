import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from './user-role.enum';
export { UserRole } from './user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  walletAddress!: string;

  @Column({ nullable: true })
  nonce?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({
    type: 'text',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  // New profile fields
  @Column({ type: 'varchar', length: 100, nullable: true })
  displayName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email?: string;

  @Column({ default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'varchar', length: 20, default: 'XLM' })
  preferredAsset!: string;

  // @ManyToOne(() => Organization, (org: Organization) => org.users, { nullable: false })
  // @JoinColumn({ name: 'org_id' })
  // organization!: Organization;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
