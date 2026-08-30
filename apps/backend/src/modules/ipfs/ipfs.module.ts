import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { IpfsService } from './ipfs.service';
import { IpfsController } from './ipfs.controller';
import { IpfsProviderService } from './services/ipfs-provider.service';
import ipfsConfig from '../../config/ipfs.config';
import { Escrow } from '../escrow/entities/escrow.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow]),
    ConfigModule.forFeature(ipfsConfig),
  ],
  providers: [IpfsService, IpfsProviderService],
  controllers: [IpfsController],
  exports: [IpfsService, IpfsProviderService],
})
export class IpfsModule {}
