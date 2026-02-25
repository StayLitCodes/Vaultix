import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  keyHash: string; // store hashed version only

  @Column()
  ownerUserId: string;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column({ type: 'int', default: 60 })
  rateLimitPerMinute: number;

  @CreateDateColumn()
  createdAt: Date;
}
