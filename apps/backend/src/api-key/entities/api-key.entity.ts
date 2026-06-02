import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ApiKeyTier {
  NONE = 'none',
  FREE = 'free',
  PRO = 'pro',
}

// Rate limits per tier (requests per minute)
export const TIER_LIMITS: Record<ApiKeyTier, number> = {
  [ApiKeyTier.NONE]: 60,
  [ApiKeyTier.FREE]: 120,
  [ApiKeyTier.PRO]: 600,
};

@Entity()
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  keyHash: string;

  @Column()
  ownerUserId: string;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  revokedAt?: Date;

  @Column({ type: 'text', default: ApiKeyTier.FREE })
  tier: ApiKeyTier;

  @Column({ type: 'int', default: 120 })
  rateLimitPerMinute: number;

  @CreateDateColumn()
  createdAt: Date;
}
