import { validate } from 'class-validator';
import {
  ChallengeDto,
  VerifyDto,
  RefreshTokenDto,
  LogoutDto,
} from './auth.dto';

describe('Auth DTOs', () => {
  describe('ChallengeDto', () => {
    it('should validate a valid Stellar address', async () => {
      const dto = new ChallengeDto();
      dto.walletAddress =
        'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DABC';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid Stellar address', async () => {
      const dto = new ChallengeDto();
      dto.walletAddress = 'invalid';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty wallet address', async () => {
      const dto = new ChallengeDto();
      dto.walletAddress = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('VerifyDto', () => {
    it('should validate with valid signature and public key', async () => {
      const dto = new VerifyDto();
      dto.signature = 'valid-signature';
      dto.publicKey =
        'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DABC';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid public key', async () => {
      const dto = new VerifyDto();
      dto.signature = 'valid-signature';
      dto.publicKey = 'invalid';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject empty signature', async () => {
      const dto = new VerifyDto();
      dto.signature = '';
      dto.publicKey =
        'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DABC';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject signature exceeding max length', async () => {
      const dto = new VerifyDto();
      dto.signature = 'A'.repeat(256);
      dto.publicKey =
        'GD5JDQXKEVPR7QD2R7LXKXN7M4ZGAPYI7F7DQ7K7D7D7D7D7D7D7DABC';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('RefreshTokenDto', () => {
    it('should validate with valid refresh token', async () => {
      const dto = new RefreshTokenDto();
      dto.refreshToken = 'valid-refresh-token';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty refresh token', async () => {
      const dto = new RefreshTokenDto();
      dto.refreshToken = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject refresh token exceeding max length', async () => {
      const dto = new RefreshTokenDto();
      dto.refreshToken = 'A'.repeat(501);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('LogoutDto', () => {
    it('should validate with valid refresh token', async () => {
      const dto = new LogoutDto();
      dto.refreshToken = 'valid-refresh-token';
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject empty refresh token', async () => {
      const dto = new LogoutDto();
      dto.refreshToken = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject refresh token exceeding max length', async () => {
      const dto = new LogoutDto();
      dto.refreshToken = 'A'.repeat(501);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
