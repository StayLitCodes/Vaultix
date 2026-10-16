// backend/src/config/kyc.config.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KycConfigService {
    constructor(private readonly configService: ConfigService) {
        this.validateProductionConfiguration();
    }

    private validateProductionConfiguration() {
        const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
        const kycProvider = this.configService.get<string>('KYC_PROVIDER', 'mock');
        const amlProvider = this.configService.get<string>('AML_PROVIDER', 'mock');
        const allowMockInProd = this.configService.get<string>('ALLOW_MOCK_VERIFICATION_IN_PROD') === 'true';

        if (nodeEnv === 'production' && !allowMockInProd) {
            if (kycProvider === 'mock' || amlProvider === 'mock') {
                throw new InternalServerErrorException(
                    `[SECURITY CRITICAL] Production startup rejected: Mock KYC/AML verification providers are not permitted in production environments (KYC: ${kycProvider}, AML: ${amlProvider}). Set explicit production verification providers or enable ALLOW_MOCK_VERIFICATION_IN_PROD=true only if explicitly required for isolated staging audits.`
                );
            }
        }
    }

    getKycProvider(): string {
        return this.configService.get<string>('KYC_PROVIDER', 'mock');
    }

    getAmlProvider(): string {
        return this.configService.get<string>('AML_PROVIDER', 'mock');
    }

    isMockWebhookAllowed(reqEnv: string): boolean {
        const nodeEnv = this.configService.get<string>('NODE_ENV', reqEnv);
        return nodeEnv !== 'production';
    }
}