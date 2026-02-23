import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserRole } from './user-role.enum';
import { Organization } from '../../organization/entities/organization.entity';
import { ManyToOne, JoinColumn } from 'typeorm';

export { UserRole } from './user-role.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  walletAddress: string;

  @Column({ nullable: true })
  nonce?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'text',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @ManyToOne(() => Organization, (org) => org.users, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
