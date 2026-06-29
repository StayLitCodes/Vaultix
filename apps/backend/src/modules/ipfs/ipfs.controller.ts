import { Controller, Get, Param, Redirect, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IpfsService } from './ipfs.service';

@Controller('ipfs')
@ApiTags('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Get(':cid')
  @Redirect()
  @ApiOperation({ summary: 'Redirect an IPFS content identifier to the configured gateway' })
  @ApiParam({ name: 'cid', description: 'IPFS content identifier' })
  @ApiResponse({ status: HttpStatus.FOUND, description: 'Content redirected to the IPFS gateway' })
  getFile(@Param('cid') cid: string) {
    const url = this.ipfsService.getGatewayUrl(cid);
    return { url, statusCode: 302 };
  }
}
