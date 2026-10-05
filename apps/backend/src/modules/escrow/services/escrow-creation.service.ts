import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigType } from '@nestjs/config';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import stellarConfigFactory from '../../../config/stellar.config';
import { StellarService } from '../../../services/stellar.service';
import {
  SorobanClientService,
  SorobanSimulationError,
} from '../../../services/stellar/soroban-client.service';
import { EscrowOperationsService } from '../../../services/stellar/escrow-operations';
import { Escrow } from '../entities/escrow.entity';
import {
  EscrowCreationIntent,
  EscrowCreationIntentStatus,
} from '../entities/escrow-creation-intent.entity';
import { User } from '../../user/entities/user.entity';
import { AllowedAsset } from '../../assets/entities/allowed-asset.entity';
import { EscrowService } from './escrow.service';
import { PrepareEscrowCreationDto } from '../dto/create-escrow-intent.dto';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { ConditionType } from '../entities/condition.entity';
import { PartyRole } from '../entities/party.entity';
import { decimalToBaseUnits } from '../amount.util';

@Injectable()
export class EscrowCreationService {
  private readonly logger = new Logger(EscrowCreationService.name);
  private readonly maxSettlementWaitMs = 90_000;
  private readonly settlementPollMs = 2_000;

  constructor(
    @InjectRepository(EscrowCreationIntent)
    private readonly intentRepository: Repository<EscrowCreationIntent>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AllowedAsset)
    private readonly assetRepository: Repository<AllowedAsset>,
    private readonly escrowService: EscrowService,
    private readonly stellarService: StellarService,
    private readonly sorobanClient: SorobanClientService,
    private readonly escrowOperations: EscrowOperationsService,
    @Inject(stellarConfigFactory.KEY)
    private readonly stellarConfig: ConfigType<typeof stellarConfigFactory>,
  ) {}

  async prepare(
    dto: PrepareEscrowCreationDto,
    creatorId: string,
    sourceAddress: string,
  ): Promise<{ intentId: string; chainEscrowId: string; unsignedXdr: string }> {
    if (!process.env.STELLAR_CONTRACT_ID) {
      throw new ServiceUnavailableException(
        'Soroban escrow contract is not configured',
      );
    }
    if (dto.counterpartyAddress === sourceAddress) {
      throw new BadRequestException(
        'The counterparty must be a different wallet',
      );
    }

    const [counterparty, asset] = await Promise.all([
      this.userRepository.findOne({
        where: { walletAddress: dto.counterpartyAddress },
      }),
      this.assetRepository.findOne({
        where: { code: dto.asset, active: true },
      }),
    ]);
    if (!counterparty) {
      throw new BadRequestException(
        'The counterparty must have a registered Vaultix account',
      );
    }
    if (!asset)
      throw new BadRequestException(`Asset ${dto.asset} is not supported`);
    if (
      !Number.isInteger(asset.decimals) ||
      asset.decimals < 0 ||
      asset.decimals > 7
    ) {
      throw new BadRequestException(
        `Asset ${dto.asset} has unsupported precision`,
      );
    }

    const payload = this.payloadSnapshot(dto);
    const payloadJson = JSON.stringify(payload);
    const existing = await this.intentRepository.findOne({
      where: { id: dto.intentId },
    });
    if (existing) {
      if (
        existing.creatorId !== creatorId ||
        existing.sourceAddress !== sourceAddress
      ) {
        throw new ConflictException(
          'This escrow creation intent belongs to another wallet',
        );
      }
      if (JSON.stringify(existing.payload) !== payloadJson) {
        throw new ConflictException(
          'This escrow creation intent is bound to different escrow details',
        );
      }
      if (existing.status === EscrowCreationIntentStatus.CONFIRMED) {
        throw new ConflictException(
          'This escrow creation intent has already been confirmed',
        );
      }
      if (existing.status === EscrowCreationIntentStatus.SUBMITTED) {
        throw new ConflictException(
          'This escrow is already submitting; retry its submission status',
        );
      }
    }

    const amountUnits = decimalToBaseUnits(dto.amount, asset.decimals);
    this.assertPersistableAmount(dto.amount);
    const milestones = this.getMilestones(dto, amountUnits, asset.decimals);
    const deadline = Math.floor(new Date(dto.deadline).getTime() / 1000);
    if (deadline <= Math.floor(Date.now() / 1000) + 60) {
      throw new BadRequestException(
        'The deadline must be at least one minute in the future',
      );
    }

    const chainEscrowId =
      existing?.chainEscrowId ?? this.deriveChainEscrowId(dto.intentId);
    const metadataHash = createHash('sha256').update(payloadJson).digest('hex');
    const nativeTokenContract = process.env.STELLAR_NATIVE_TOKEN_CONTRACT_ID;
    if (asset.code === 'XLM' && !nativeTokenContract) {
      throw new ServiceUnavailableException(
        'The native XLM Soroban token contract is not configured for this network',
      );
    }
    const tokenAddress =
      asset.code === 'XLM'
        ? nativeTokenContract!
        : new StellarSdk.Asset(asset.code, asset.issuer).contractId(
            this.stellarConfig.networkPassphrase,
          );
    const operations = this.escrowOperations.createEscrowInitializationOps(
      chainEscrowId,
      sourceAddress,
      dto.counterpartyAddress,
      tokenAddress,
      milestones,
      deadline,
      metadataHash,
      asset.decimals,
    );

    const transaction = await this.stellarService.buildTransaction(
      sourceAddress,
      operations,
    );
    let unsignedXdr: string;
    try {
      unsignedXdr = await this.sorobanClient.prepareTransaction(transaction);
    } catch (error) {
      if (error instanceof SorobanSimulationError) {
        throw new BadRequestException(
          `Soroban rejected the escrow: ${error.message}`,
        );
      }
      throw new ServiceUnavailableException(
        'Unable to prepare the escrow transaction',
      );
    }

    if (existing) {
      existing.unsignedXdr = unsignedXdr;
      existing.status = EscrowCreationIntentStatus.PREPARED;
      await this.intentRepository.save(existing);
    } else {
      await this.intentRepository.save(
        this.intentRepository.create({
          id: dto.intentId,
          creatorId,
          sourceAddress,
          chainEscrowId,
          payload,
          unsignedXdr,
          status: EscrowCreationIntentStatus.PREPARED,
        }),
      );
    }

    return { intentId: dto.intentId, chainEscrowId, unsignedXdr };
  }

  async submit(
    intentId: string,
    signedXdr: string,
    creatorId: string,
    sourceAddress: string,
  ): Promise<{
    escrowId: string;
    transactionHash: string;
    status: 'confirmed';
  }> {
    const intent = await this.intentRepository.findOne({
      where: { id: intentId },
    });
    if (
      !intent ||
      intent.creatorId !== creatorId ||
      intent.sourceAddress !== sourceAddress
    ) {
      throw new NotFoundException('Escrow creation intent not found');
    }
    if (
      intent.status === EscrowCreationIntentStatus.CONFIRMED &&
      intent.escrowId
    ) {
      return {
        escrowId: intent.escrowId,
        transactionHash: intent.transactionHash!,
        status: 'confirmed',
      };
    }

    const transaction = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      this.stellarConfig.networkPassphrase,
    ) as StellarSdk.Transaction;
    if (transaction.source !== sourceAddress) {
      throw new BadRequestException(
        'The signed transaction source does not match the connected wallet',
      );
    }
    if (
      intent.transactionHash &&
      transaction.hash().toString('hex') !== intent.transactionHash
    ) {
      throw new ConflictException(
        'A different transaction was already submitted for this intent',
      );
    }

    const rpc = this.sorobanClient.getRpc();
    const txHash = transaction.hash().toString('hex');
    let result = await rpc.getTransaction(txHash);
    if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.NOT_FOUND) {
      const sent = await rpc.sendTransaction(transaction);
      if (sent.status === 'ERROR') {
        throw new BadRequestException(
          'Soroban RPC rejected the signed transaction',
        );
      }
      intent.transactionHash = sent.hash;
      intent.status = EscrowCreationIntentStatus.SUBMITTED;
      await this.intentRepository.save(intent);
    } else {
      intent.transactionHash = txHash;
      intent.status = EscrowCreationIntentStatus.SUBMITTED;
      await this.intentRepository.save(intent);
    }

    const start = Date.now();
    while (Date.now() - start < this.maxSettlementWaitMs) {
      result = await rpc.getTransaction(txHash);
      if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        const escrowId = await this.persistConfirmedEscrow(intent);
        intent.escrowId = escrowId;
        intent.status = EscrowCreationIntentStatus.CONFIRMED;
        await this.intentRepository.save(intent);
        return { escrowId, transactionHash: txHash, status: 'confirmed' };
      }
      if (result.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
        intent.status = EscrowCreationIntentStatus.FAILED;
        await this.intentRepository.save(intent);
        throw new BadRequestException(
          'The escrow transaction failed on Stellar',
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, this.settlementPollMs),
      );
    }
    throw new ServiceUnavailableException(
      'Escrow transaction is pending; retry to check the same submission',
    );
  }

  private async persistConfirmedEscrow(
    intent: EscrowCreationIntent,
  ): Promise<string> {
    const existing = await this.escrowRepository.findOne({
      where: { chainEscrowId: intent.chainEscrowId },
    });
    if (existing) return existing.id;

    const payload = intent.payload as unknown as PrepareEscrowCreationDto;
    const [creator, counterparty, asset] = await Promise.all([
      this.userRepository.findOne({ where: { id: intent.creatorId } }),
      this.userRepository.findOne({
        where: { walletAddress: payload.counterpartyAddress },
      }),
      this.assetRepository.findOne({
        where: { code: payload.asset, active: true },
      }),
    ]);
    if (!creator || !counterparty || !asset) {
      throw new ServiceUnavailableException(
        'Escrow parties or asset changed before transaction confirmation',
      );
    }

    const metadataHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const conditions = [
      ...payload.milestones.map((milestone) => ({
        description: milestone.description,
        type: ConditionType.MANUAL,
        metadata: { amount: milestone.amount, kind: 'milestone' },
      })),
      ...payload.conditions.map((condition) => ({
        description: condition.description || condition.type,
        type:
          condition.type === 'time'
            ? ConditionType.TIME_BASED
            : condition.type === 'oracle'
              ? ConditionType.ORACLE
              : ConditionType.MANUAL,
        metadata: condition.releaseDate
          ? { releaseDate: condition.releaseDate, kind: 'condition' }
          : { kind: 'condition' },
      })),
    ];
    const createDto = {
      title: payload.title,
      description: payload.description,
      amount: payload.amount,
      asset: { code: asset.code, issuer: asset.issuer },
      type: payload.milestones.length > 0 ? 'milestone' : 'standard',
      parties: [
        { userId: intent.creatorId, role: PartyRole.BUYER },
        { userId: counterparty.id, role: PartyRole.SELLER },
      ],
      conditions,
      expiresAt: payload.deadline,
      metadataHash,
    } as unknown as CreateEscrowDto;
    const escrow = await this.escrowService.create(createDto, intent.creatorId);
    await this.escrowRepository.update(escrow.id, {
      chainEscrowId: intent.chainEscrowId,
      stellarTxHash: intent.transactionHash,
    });
    return escrow.id;
  }

  private payloadSnapshot(
    dto: PrepareEscrowCreationDto,
  ): Record<string, unknown> {
    return {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      amount: dto.amount,
      asset: dto.asset,
      counterpartyAddress: dto.counterpartyAddress,
      deadline: new Date(dto.deadline).toISOString(),
      milestones: dto.milestones ?? [],
      conditions: dto.conditions ?? [],
    };
  }

  private getMilestones(
    dto: PrepareEscrowCreationDto,
    totalUnits: bigint,
    decimals: number,
  ): Array<{ id: number; amount: string; description: string }> {
    const milestones = dto.milestones.length
      ? dto.milestones
      : [{ description: dto.title, amount: dto.amount }];
    milestones.forEach((milestone) =>
      this.assertPersistableAmount(milestone.amount),
    );
    const sum = milestones.reduce(
      (acc, milestone) => acc + decimalToBaseUnits(milestone.amount, decimals),
      0n,
    );
    if (sum !== totalUnits) {
      throw new BadRequestException(
        'Milestone amounts must add up exactly to the escrow total',
      );
    }
    return milestones.map((milestone, id) => ({
      id,
      amount: milestone.amount,
      description: milestone.description
        .slice(0, 32)
        .replace(/[^A-Za-z0-9_]/g, '_'),
    }));
  }

  private assertPersistableAmount(amount: string): void {
    const [whole] = amount.split('.');
    // Escrow and condition database columns are DECIMAL(18,7).
    if (whole.length > 11) {
      throw new BadRequestException(
        'Amount exceeds the supported escrow storage range',
      );
    }
  }

  private deriveChainEscrowId(intentId: string): string {
    const raw = createHash('sha256')
      .update(intentId)
      .digest()
      .readBigUInt64BE(0);
    return (raw & ((1n << 63n) - 1n) || 1n).toString();
  }
}
