import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';

import stellarConfig from '../../../config/stellar.config';
import { Escrow } from '../entities/escrow.entity';
import { PartyRole } from '../entities/party.entity';
import {
  SorobanIntentStatus,
  SorobanOperation,
  SorobanTxIntent,
} from '../entities/soroban-tx-intent.entity';
import {
  AuthorizationRequirementDto,
  PrepareIntentDto,
  PrepareIntentResponseDto,
} from '../dto/prepare-intent.dto';
import { EscrowOperationsService } from '../../../services/stellar/escrow-operations';
import { SorobanClientService } from '../../../services/stellar/soroban-client.service';
import { StellarService } from '../../../services/stellar.service';

/** How long a prepared intent stays submittable. */
export const INTENT_TTL_SECONDS = 300;
/**
 * Transaction time bounds. The upper bound is the real expiry the network
 * enforces; the intent TTL is the server-side window for accepting it.
 */
const TX_MAX_VALIDITY_SECONDS = 600;
const BASE_FEE_STROOPS = 100;

@Injectable()
export class SorobanIntentService {
  private readonly logger = new Logger(SorobanIntentService.name);
  private readonly networkPassphrase: string;

  constructor(
    @Inject(stellarConfig.KEY)
    private readonly config: ConfigType<typeof stellarConfig>,
    private readonly stellarService: StellarService,
    private readonly escrowOperationsService: EscrowOperationsService,
    private readonly sorobanClient: SorobanClientService,
    @InjectRepository(SorobanTxIntent)
    private readonly intentRepository: Repository<SorobanTxIntent>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
  ) {
    this.networkPassphrase = this.config.networkPassphrase;
  }

  /**
   * Prepares a wallet-signable Soroban transaction for `dto.operation`.
   *
   * The server simulates and assembles the envelope so the wallet is asked to
   * sign something that is already resource-correct and time-bounded, then
   * freezes the binding (user, network, contract, escrow, on-chain id,
   * operation) into a short-lived intent. No user secret key is involved.
   */
  async prepare(
    escrow: Escrow,
    userId: string,
    authenticatedWallet: string,
    dto: PrepareIntentDto,
  ): Promise<PrepareIntentResponseDto> {
    const contractId = this.sorobanClient.getContractId();
    if (!contractId) {
      throw new BadRequestException(
        'Soroban contract is not configured (STELLAR_CONTRACT_ID)',
      );
    }

    const sourceAccount = dto.sourceAccount ?? authenticatedWallet;
    if (!this.isValidPublicKey(sourceAccount)) {
      throw new BadRequestException('Invalid source account');
    }
    // Simulating on behalf of an arbitrary account would burn the server's RPC
    // quota and hand a caller a transaction sourced from someone else's
    // account, so the source must be the caller's own wallet or a party on
    // this escrow.
    await this.assertSourceAccountAllowed(
      escrow,
      sourceAccount,
      authenticatedWallet,
    );

    // A previously prepared intent for the same operation is superseded: the
    // caller is explicitly re-preparing, so the old XDR must not stay valid.
    await this.expireStaleIntents(escrow.id, userId, dto.operation);

    const onChainEscrowId =
      dto.operation === SorobanOperation.CREATE_ESCROW
        ? await this.resolveOnChainEscrowId(escrow)
        : this.requireExistingOnChainId(escrow);

    const operations =
      dto.operation === SorobanOperation.CREATE_ESCROW
        ? await this.buildCreateOperations(escrow, onChainEscrowId)
        : this.escrowOperationsService.createFundingOps(onChainEscrowId);

    const maxTime = Math.floor(Date.now() / 1000) + TX_MAX_VALIDITY_SECONDS;
    const expiresAt = new Date(
      Math.min(Date.now() + INTENT_TTL_SECONDS * 1000, maxTime * 1000),
    );

    const { transaction, simulation } = await this.simulateAndAssemble(
      sourceAccount,
      operations,
      maxTime,
    );

    const intentHash = this.computeIntentHash({
      userId,
      escrowId: escrow.id,
      onChainEscrowId,
      operation: dto.operation,
      sourceAccount,
      networkPassphrase: this.networkPassphrase,
      contractId,
    });

    const intent = this.intentRepository.create({
      escrowId: escrow.id,
      onChainEscrowId,
      userId,
      operation: dto.operation,
      sourceAccount,
      networkPassphrase: this.networkPassphrase,
      contractId,
      intentHash,
      unsignedXdr: transaction.toXDR(),
      expiresAt,
      status: SorobanIntentStatus.PENDING,
      feeStroops: String(transaction.fee),
      resourceFeeStroops: simulation.minResourceFee
        ? String(simulation.minResourceFee)
        : null,
      simulatedAtLedger: simulation.latestLedger
        ? String(simulation.latestLedger)
        : null,
    });

    const saved = await this.intentRepository.save(intent);
    this.logger.log(
      `Prepared ${dto.operation} intent ${saved.id} for escrow ${escrow.id} (on-chain ${onChainEscrowId}), expires ${expiresAt.toISOString()}`,
    );

    return this.toResponse(saved, simulation.result?.auth, maxTime);
  }

  /**
   * Loads an intent and asserts it may still be used, throwing the most
   * specific reason. Shared by the submission path so the binding checks live
   * in exactly one place.
   */
  async assertUsable(
    intentId: string,
    userId: string,
  ): Promise<SorobanTxIntent> {
    const intent = await this.intentRepository.findOne({
      where: { id: intentId },
    });
    if (!intent) {
      throw new NotFoundException('Transaction intent not found');
    }
    if (intent.userId !== userId) {
      // Do not disclose that the intent exists for another account.
      throw new NotFoundException('Transaction intent not found');
    }
    if (
      intent.networkPassphrase !== this.networkPassphrase ||
      intent.contractId !== this.sorobanClient.getContractId()
    ) {
      throw new BadRequestException(
        'Transaction intent was prepared for a different network or contract',
      );
    }
    if (intent.status === SorobanIntentStatus.EXPIRED) {
      throw new BadRequestException('Transaction intent has expired');
    }
    if (intent.expiresAt.getTime() <= Date.now()) {
      await this.markExpired(intent);
      throw new BadRequestException('Transaction intent has expired');
    }
    if (intent.status !== SorobanIntentStatus.PENDING) {
      throw new BadRequestException(
        `Transaction intent is already ${intent.status.toLowerCase()}`,
      );
    }
    return intent;
  }

  async findOne(intentId: string, userId: string): Promise<SorobanTxIntent> {
    const intent = await this.intentRepository.findOne({
      where: { id: intentId },
    });
    if (!intent || intent.userId !== userId) {
      throw new NotFoundException('Transaction intent not found');
    }
    return intent;
  }

  /**
   * Allocates (once) the u64 the contract will use. The contract rejects a
   * duplicate id, so the unique index is the real guard: on a collision the
   * allocation is retried rather than silently reused.
   */
  private async resolveOnChainEscrowId(escrow: Escrow): Promise<string> {
    if (escrow.onChainId) {
      return escrow.onChainId;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const row = await this.escrowRepository
        .createQueryBuilder('escrow')
        .select('MAX(CAST(escrow.onChainId AS INTEGER))', 'maxId')
        .getRawOne<{ maxId: string | null }>();
      const current = row?.maxId ? BigInt(row.maxId) : 0n;
      const candidate = (current + 1n + BigInt(attempt)).toString();

      try {
        await this.escrowRepository.update(escrow.id, {
          onChainId: candidate,
        });
        escrow.onChainId = candidate;
        return candidate;
      } catch {
        this.logger.warn(
          `On-chain id ${candidate} for escrow ${escrow.id} collided, retrying`,
        );
      }
    }
    throw new BadRequestException(
      'Unable to allocate an on-chain escrow id, please retry',
    );
  }

  private requireExistingOnChainId(escrow: Escrow): string {
    if (!escrow.onChainId) {
      throw new BadRequestException(
        'Escrow has not been prepared for on-chain creation yet',
      );
    }
    return escrow.onChainId;
  }

  private async buildCreateOperations(
    escrow: Escrow,
    onChainEscrowId: string,
  ): Promise<StellarSdk.xdr.Operation[]> {
    if (!escrow.metadataHash) {
      throw new BadRequestException(
        'Escrow is missing metadataHash required for on-chain creation',
      );
    }

    const full = await this.escrowRepository.findOne({
      where: { id: escrow.id },
      relations: ['parties', 'parties.user', 'conditions'],
    });
    if (!full) {
      throw new NotFoundException('Escrow not found');
    }

    const depositor = full.parties?.find((p) => p.role === PartyRole.BUYER);
    const recipient = full.parties?.find((p) => p.role === PartyRole.SELLER);
    if (!depositor?.user?.walletAddress) {
      throw new BadRequestException('Escrow has no buyer party with a wallet');
    }
    if (!recipient?.user?.walletAddress) {
      throw new BadRequestException('Escrow has no seller party with a wallet');
    }

    const conditionCount = full.conditions?.length ?? 0;
    const perMilestone = (
      Number(full.amount.toString()) / (conditionCount || 1)
    ).toString();

    return this.escrowOperationsService.createEscrowInitializationOps(
      onChainEscrowId,
      depositor.user.walletAddress,
      recipient.user.walletAddress,
      full.assetCode === 'XLM'
        ? 'native'
        : new StellarSdk.Asset(
            full.assetCode,
            full.assetIssuer as string,
          ).contractId(this.networkPassphrase),
      (full.conditions ?? []).map((condition, index) => ({
        id: index,
        amount: perMilestone,
        description: condition.description,
      })),
      full.expiresAt
        ? Math.floor(new Date(full.expiresAt).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 86400,
      full.metadataHash ?? '',
    );
  }

  /**
   * Builds, simulates and assembles the transaction. A simulation error is
   * surfaced as a 400 with the decoded contract error rather than being
   * returned as XDR the wallet would only fail on later.
   */
  private async simulateAndAssemble(
    sourceAccount: string,
    operations: StellarSdk.xdr.Operation[],
    maxTime: number,
  ): Promise<{
    transaction: StellarSdk.Transaction;
    simulation: StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
  }> {
    const rpc = this.sorobanClient.getRpc();
    if (!rpc) {
      throw new BadRequestException('Soroban RPC is not configured');
    }

    const account = await this.stellarService.getAccount(sourceAccount);
    const builder = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(sourceAccount, account.sequenceNumber()),
      {
        fee: String(BASE_FEE_STROOPS),
        networkPassphrase: this.networkPassphrase,
      },
    );
    for (const operation of operations) {
      builder.addOperation(operation);
    }
    // setTimeout() takes a *duration*; we need an absolute window so the
    // expiry the wallet sees is the one the network will enforce.
    const draft = builder.setTimebounds(0, maxTime).build();

    const simulation = await rpc.simulateTransaction(draft);
    if ('error' in simulation && simulation.error) {
      throw new BadRequestException(
        `Contract simulation failed: ${this.decodeSimulationError(simulation.error)}`,
      );
    }

    const success =
      simulation as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse;
    if (!success.result) {
      throw new BadRequestException(
        'Soroban simulation returned no invocation result',
      );
    }

    // assembleTransaction clones the draft (time bounds included) and folds the
    // simulated resource fee into the classic fee, so the builder is already
    // complete. Re-applying time bounds here would throw.
    const transaction = StellarSdk.rpc
      .assembleTransaction(draft, simulation)
      .build();
    return { transaction, simulation: success };
  }

  /** The SDK exposes no isValidPublicKey helper on Keypair in this version. */
  private isValidPublicKey(candidate: string): boolean {
    try {
      StellarSdk.Keypair.fromPublicKey(candidate);
      return true;
    } catch {
      return false;
    }
  }

  private decodeSimulationError(error: string): string {
    const match = /Error\(Contract, #(\d+)\)/.exec(error);
    if (match) {
      return `${this.sorobanClient.decodeContractError(Number(match[1]))} (code ${match[1]})`;
    }
    const insufficient =
      /(insufficient|insufficient resources|resources)/i.exec(error);
    if (insufficient) {
      return `insufficient resources: ${error}`;
    }
    return error;
  }

  /**
   * Binds the intent to everything the submission path must re-check. Hashing
   * the tuple means a mutated row cannot produce a matching hash.
   */
  private computeIntentHash(binding: {
    userId: string;
    escrowId: string;
    onChainEscrowId: string;
    operation: SorobanOperation;
    sourceAccount: string;
    networkPassphrase: string;
    contractId: string;
  }): string {
    return createHash('sha256')
      .update(
        [
          binding.userId,
          binding.escrowId,
          binding.onChainEscrowId,
          binding.operation,
          binding.sourceAccount,
          binding.networkPassphrase,
          binding.contractId,
        ].join('|'),
      )
      .digest('hex');
  }

  private toResponse(
    intent: SorobanTxIntent,
    auth: StellarSdk.xdr.SorobanAuthorizationEntry[] | undefined,
    maxTime: number,
  ): PrepareIntentResponseDto {
    const requirements = this.toAuthRequirements(auth);

    return {
      intentId: intent.id,
      operation: intent.operation,
      escrowId: intent.escrowId,
      onChainEscrowId: intent.onChainEscrowId,
      sourceAccount: intent.sourceAccount,
      networkPassphrase: intent.networkPassphrase,
      contractId: intent.contractId,
      unsignedXdr: intent.unsignedXdr,
      feeStroops: String(intent.feeStroops ?? 0),
      resourceFeeStroops: String(intent.resourceFeeStroops ?? 0),
      simulatedAtLedger: String(intent.simulatedAtLedger ?? 0),
      authRequirements: requirements,
      // Reported from the window actually baked into the envelope, which is
      // wider than the (shorter) server-side intent TTL.
      timeBounds: { minTime: 0, maxTime },
      expiresAt: intent.expiresAt.toISOString(),
    };
  }

  /**
   * Flattens simulated auth entries into the addresses a wallet must sign for.
   *
   * A `sorobanCredentialsSourceAccount` arm is deliberately skipped: it carries
   * only a nonce and is satisfied by the transaction source's own signature.
   * Everything else names a concrete account or contract that must authorize.
   */
  private toAuthRequirements(
    auth: StellarSdk.xdr.SorobanAuthorizationEntry[] | undefined,
  ): AuthorizationRequirementDto[] {
    const requirements: AuthorizationRequirementDto[] = [];
    for (const entry of auth ?? []) {
      const credentials = entry.credentials();
      if (credentials.switch().name !== 'sorobanCredentialsAddress') {
        continue;
      }
      const scAddress = credentials.address().address();
      if (scAddress.switch().name === 'scAddressTypeAccount') {
        requirements.push({
          type: 'sorobanCredentialsAddress',
          // accountId() is typed PublicKey but is a raw 32-byte key.
          address: StellarSdk.StrKey.encodeEd25519PublicKey(
            Buffer.from(scAddress.accountId() as unknown as Uint8Array),
          ),
        });
      } else if (scAddress.switch().name === 'scAddressTypeContract') {
        requirements.push({
          type: 'sorobanCredentialsAddress',
          // Hash is an untyped Uint8Array in this SDK build.
          address: StellarSdk.StrKey.encodeContract(
            Buffer.from(scAddress.contractId() as unknown as Uint8Array),
          ),
        });
      }
    }
    return requirements;
  }

  private async assertSourceAccountAllowed(
    escrow: Escrow,
    sourceAccount: string,
    authenticatedWallet: string,
  ): Promise<void> {
    if (sourceAccount === authenticatedWallet) {
      return;
    }
    const allowed = await this.escrowRepository
      .createQueryBuilder('party')
      .innerJoin('party.user', 'user')
      .where('party.escrowId = :escrowId', { escrowId: escrow.id })
      .andWhere('user.walletAddress = :sourceAccount', { sourceAccount })
      .getExists();
    if (!allowed) {
      throw new ForbiddenException(
        'Source account is neither the authenticated wallet nor a party on this escrow',
      );
    }
  }

  private async expireStaleIntents(
    escrowId: string,
    userId: string,
    operation: SorobanOperation,
  ): Promise<void> {
    await this.intentRepository.update(
      { escrowId, userId, operation, status: SorobanIntentStatus.PENDING },
      { status: SorobanIntentStatus.EXPIRED },
    );
  }

  private async markExpired(intent: SorobanTxIntent): Promise<void> {
    intent.status = SorobanIntentStatus.EXPIRED;
    await this.intentRepository.save(intent);
  }
}
