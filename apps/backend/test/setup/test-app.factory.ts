import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../../src/app.module';
import { stellarMock } from './mocks/stellar.mock';
import { blockchainMock } from './mocks/blockchain.mock';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider('StellarService')
    .useValue(stellarMock)
    .overrideProvider('BlockchainService')
    .useValue(blockchainMock)
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return app;
}
