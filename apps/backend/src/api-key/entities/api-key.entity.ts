import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export enum ApiKeyScope {
  READ_ESCROWS = 'read:escrows',
  WRITE_ESCROWS = 'write:escrows',
  READ_ANALYTICS = 'read:analytics',
  ADMIN = 'admin',
}

@Entity('api_key')
export class ApiKey {
  @PrimaryColumn('varchar')
  id!: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column()
  userId!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  keyHash!: string;

  @Column()
  keyPrefix!: string;

  @Column('simple-array')
  scopes!: ApiKeyScope[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ nullable: true })
  lastUsedAt?: Date;

  @Column({ nullable: true })
  expiresAt?: Date;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column({ type: 'int', default: 200 })
  rateLimitPerMinute!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
