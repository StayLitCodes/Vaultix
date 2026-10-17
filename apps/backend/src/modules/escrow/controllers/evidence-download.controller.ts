import { Controller, Get, Param, Query, Res, Version } from '@nestjs/common';
import { Response } from 'express';
import { EscrowEvidenceService } from '../services/escrow-evidence.service';

/** Public only in the sense that it does not require a session: access is constrained by an expiring HMAC URL. */
@Controller('evidence-download')
export class EvidenceDownloadController {
  constructor(private readonly evidenceService: EscrowEvidenceService) {}

  @Get(':escrowId/:cid')
  @Version('1')
  async download(
    @Param('escrowId') escrowId: string,
    @Param('cid') cid: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() response: Response,
  ): Promise<void> {
    await this.evidenceService.getEvidenceFileBySignedUrl(
      escrowId,
      cid,
      expires,
      signature,
      response,
    );
  }
}
