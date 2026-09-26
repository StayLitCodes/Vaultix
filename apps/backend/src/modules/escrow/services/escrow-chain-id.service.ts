import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import stellarConfig from '../../../config/stellar.config';
import {
  EscrowChainId,
  EscrowChainIdStatus,
} from '../entities/escrow-chain-id.entity';
import { validateSorobanU64 } from '../utils/soroban-u64.util';

@Injectable()
export class EscrowChainIdService {
  private readonly network: string;
  private readonly contractId: string;

  constructor(
    @Inject(stellarConfig.KEY) config: ConfigType<typeof stellarConfig>,
    @InjectRepository(EscrowChainId)
    private readonly repo: Repository<EscrowChainId>,
  ) {
    this.network = config.network;
    this.contractId = process.env.STELLAR_CONTRACT_ID || '';
  }

  private assertConfigured(): void {
    if (!this.contractId)
      throw new Error(
        'STELLAR_CONTRACT_ID is required to resolve escrow chain IDs',
      );
  }

  async allocate(escrowId: string): Promise<string> {
    this.assertConfigured();
    const current = await this.repo.findOne({
      where: { network: this.network, contractId: this.contractId, escrowId },
    });
    if (current?.onChainId && current.status === EscrowChainIdStatus.MAPPED)
      return current.onChainId;
    if (current) {
      throw new ConflictException(
        `Escrow ${escrowId} has an unmapped historical Soroban ID and cannot be allocated automatically`,
      );
    }

    // A unique constraint arbitrates concurrent allocators. Random candidates are persisted
    // before use; a loser reads the winning mapping instead of deriving a different ID.
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = BigInt(
        `0x${randomBytes(8).toString('hex')}`,
      ).toString();
      try {
        await this.repo.insert({
          network: this.network,
          contractId: this.contractId,
          escrowId,
          onChainId: candidate,
          status: EscrowChainIdStatus.MAPPED,
        });
        return candidate;
      } catch {
        const winner = await this.repo.findOne({
          where: {
            network: this.network,
            contractId: this.contractId,
            escrowId,
          },
        });
        if (winner?.onChainId && winner.status === EscrowChainIdStatus.MAPPED)
          return winner.onChainId;
        if (attempt === 7)
          throw new ConflictException(
            'Could not allocate a unique Soroban escrow ID',
          );
      }
    }
    throw new ConflictException('Could not allocate a Soroban escrow ID');
  }

  async requireForEscrow(escrowId: string): Promise<string> {
    this.assertConfigured();
    const row = await this.repo.findOne({
      where: { network: this.network, contractId: this.contractId, escrowId },
    });
    if (!row || row.status !== EscrowChainIdStatus.MAPPED || !row.onChainId) {
      throw new NotFoundException(
        `Escrow ${escrowId} has no verified Soroban ID mapping`,
      );
    }
    return validateSorobanU64(row.onChainId);
  }

  async findEscrowId(onChainId: string): Promise<string | null> {
    this.assertConfigured();
    validateSorobanU64(onChainId);
    const row = await this.repo.findOne({
      where: {
        network: this.network,
        contractId: this.contractId,
        onChainId,
        status: EscrowChainIdStatus.MAPPED,
      },
    });
    return row?.escrowId ?? null;
  }

  async findByEscrowId(escrowId: string): Promise<EscrowChainId | null> {
    this.assertConfigured();
    return this.repo.findOne({
      where: { network: this.network, contractId: this.contractId, escrowId },
    });
  }
}
