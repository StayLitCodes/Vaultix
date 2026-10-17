import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Index('UQ_allowed_assets_code_issuer', ['code', 'issuer'], {
  unique: true,
  where: '"issuer" IS NOT NULL',
})
@Index('UQ_allowed_assets_native_code', ['code'], {
  unique: true,
  where: '"issuer" IS NULL',
})
@Entity('allowed_assets')
export class AllowedAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12 })
  code: string;

  @Column({ type: 'varchar', length: 56, nullable: true }) // null for native XLM
  issuer: string | null;

  @Column({ type: 'varchar' })
  displayName: string;

  @Column({ type: 'varchar', nullable: true })
  iconUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  homeDomain: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  assetType: string | null;

  @Column({ type: 'int', nullable: true })
  numAccounts: number | null;

  @Column({ type: 'timestamp', nullable: true })
  lastValidatedAt: Date | null;

  @Column({ type: 'int', default: 7 })
  decimals: number;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
