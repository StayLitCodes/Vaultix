import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { ApiTags, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('IPFS')
@Controller('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Get(':cid')
  @Redirect()
  @ApiOperation({ summary: 'Get file from IPFS', description: 'Redirects to an IPFS gateway URL for the given CID.' })
  @ApiParam({ name: 'cid', description: 'IPFS Content Identifier' })
  @ApiOkResponse({ description: 'Redirects to file URL' })
  getFile(@Param('cid') cid: string) {
    const url = this.ipfsService.getGatewayUrl(cid);
    return { url, statusCode: 302 };
  }
}
