// backend/src/config/__tests__/kyc.config.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KycConfigService } from '../kyc.config';
import { InternalServerErrorException } from '@nestjs/common';

describe('KycConfigService (Production Mock Provider Safeguard)', () => {
    it('should throw InternalServerErrorException if production uses mock KYC/AML providers without explicit override', () => {
        const configServiceMock = {
            get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'NODE_ENV') return 'production';
                if (key === 'KYC_PROVIDER') return 'mock';
                if (key === 'AML_PROVIDER') return 'shuftipro';
                if (key === 'ALLOW_MOCK_VERIFICATION_IN_PROD') return 'false';
                return defaultValue;
            }),
        };

        expect(() => {
            new KycConfigService(configServiceMock as unknown as ConfigService);
        }).toThrow(InternalServerErrorException);
    });

    it('should allow mock providers in development environments', () => {
        const configServiceMock = {
            get: jest.fn((key: string, defaultValue?: string) => {
                if (key === 'NODE_ENV') return 'development';
                if (key === 'KYC_PROVIDER') return 'mock';
                if (key === 'AML_PROVIDER') return 'mock';
                return defaultValue;
            }),
        };

        const service = new KycConfigService(configServiceMock as unknown as ConfigService);
        expect(service.getKycProvider()).toBe('mock');
    });
});