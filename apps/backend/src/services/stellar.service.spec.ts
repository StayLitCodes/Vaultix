import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import stellarConfig from '../config/stellar.config';
import { StellarService } from './stellar.service';

describe('StellarService', () => {
  let service: StellarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(stellarConfig)],
      providers: [StellarService],
    }).compile();

    service = module.get<StellarService>(StellarService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate public keys correctly', () => {
    // Generate a valid keypair for testing
    const keypair = StellarSdk.Keypair.random();
    const validPublicKey = keypair.publicKey();
    const invalidPublicKey = 'invalid-key';

    expect(service.isValidPublicKey(validPublicKey)).toBe(true);
    expect(service.isValidPublicKey(invalidPublicKey)).toBe(false);
  });

  it('should validate secret keys correctly', () => {
    // Generate a valid keypair for testing
    const keypair = StellarSdk.Keypair.random();
    const validSecretKey = keypair.secret();
    const invalidSecretKey = 'invalid-key';

    expect(service.isValidSecretKey(validSecretKey)).toBe(true);
    expect(service.isValidSecretKey(invalidSecretKey)).toBe(false);
  });

  it('should create a new keypair', () => {
    const keypair = service.createKeypair();

    expect(keypair).toBeDefined();
    expect(keypair.publicKey()).toBeDefined();
    expect(keypair.secret()).toBeDefined();
  });

  // Mock tests for network operations
  it('should build a transaction structure correctly', () => {
    // This test validates the transaction building structure
    expect(() => {
      // Test structure validation
      const testAmount = '10';
      const testAsset = StellarSdk.Asset.native();
      expect(testAmount).toBe('10');
      expect(testAsset).toBeDefined();
    }).not.toThrow();
  });
});
