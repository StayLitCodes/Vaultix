import { Module } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { IpfsController } from './ipfs.controller';

@Module({
  providers: [IpfsService],
  controllers: [IpfsController],
  exports: [IpfsService],
})
export class IpfsModule {}
