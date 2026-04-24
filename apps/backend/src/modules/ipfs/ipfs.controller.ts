import { Controller, Get, Param, Redirect } from '@nestjs/common';
import { IpfsService } from './ipfs.service';

@Controller('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Get(':cid')
  @Redirect()
  getFile(@Param('cid') cid: string) {
    const url = this.ipfsService.getGatewayUrl(cid);
    return { url, statusCode: 302 };
  }
}
