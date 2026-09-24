import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { KycService } from '../services/kyc.service';

/**
 * Webhook controller for receiving KYC provider callbacks.
 *
 * This endpoint is called by KYC providers (Persona, Sumsub, Onfido)
 * when a verification status changes. It does NOT require JWT auth;
 * instead it validates the provider's webhook signature.
 *
 * The path includes :provider to support multiple providers:
 * - POST /kyc/webhook/persona
 * - POST /kyc/webhook/sumsub
 * - POST /kyc/webhook/onfido
 * - POST /kyc/webhook/mock (for testing)
 */
@ApiTags('KYC Webhooks')
@Controller('kyc/webhook')
export class KycWebhookController {
  private readonly logger = new Logger(KycWebhookController.name);

  constructor(private readonly kycService: KycService) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive KYC provider webhook callback',
    description:
      'Webhook endpoint called by KYC providers when a verification ' +
      'status changes. Validates the X-KYC-Signature header.',
  })
  @ApiParam({
    name: 'provider',
    description: 'KYC provider name (persona, sumsub, onfido, mock)',
    example: 'persona',
  })
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: unknown,
    @Headers('x-kyc-signature') signature: string,
  ) {
    if (!signature) {
      this.logger.warn(`Webhook call missing X-KYC-Signature header`);
      throw new BadRequestException('Missing webhook signature');
    }

    this.logger.log(
      `Received webhook from provider: ${provider}`,
    );

    await this.kycService.processWebhook(
      provider,
      payload,
      signature,
    );

    return { received: true };
  }
}
