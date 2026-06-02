/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rpc, xdr, Address, Asset } from '@stellar/stellar-sdk';
import {
  StellarEvent,
  StellarEventType,
} from '../entities/stellar-event.entity';
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';
import { SorobanClientService } from '../../../services/stellar/soroban-client.service';
import { ConsistencyCheckerService } from '../../admin/services/consistency-checker.service';
import { AllowedAsset } from '../../assets/entities/allowed-asset.entity';

@Injectable()
export class StellarEventListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(StellarEventListenerService.name);
  private server: rpc.Server;
  private contractId: string;
  private isRunning = false;
  private lastProcessedLedger = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private abortController: AbortController | null = null;

  constructor(
    private configService: ConfigService,
    @InjectRepository(StellarEvent)
    private stellarEventRepository: Repository<StellarEvent>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    private sorobanClient: SorobanClientService,
    @Inject(forwardRef(() => ConsistencyCheckerService))
    private consistencyChecker: ConsistencyCheckerService,
  ) {}

  async onModuleInit() {
    this.contractId = this.sorobanClient.getContractId();
    this.server = this.sorobanClient.getRpc();

    if (!this.contractId) {
      this.logger.error('Missing required configuration: STELLAR_CONTRACT_ID');
      return;
    }

    void this.startEventListener();
  }

  async onModuleDestroy() {
    await this.stopEventListener();
  }

  async startEventListener() {
    if (this.isRunning) {
      this.logger.warn('Event listener is already running');
      return;
    }

    this.abortController = new AbortController();
    this.isRunning = true;
    this.logger.log(
      `Starting Stellar event listener for contract: ${this.contractId}`,
    );

    try {
      // Get the last processed ledger from database
      await this.initializeLastProcessedLedger();

      // Start the event polling loop
      await this.pollEvents();
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.logger.error('Failed to start event listener:', error);
        this.isRunning = false;
      }
    }
  }

  async stopEventListener() {
    this.isRunning = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.logger.log('Stopped Stellar event listener');
  }

  private async initializeLastProcessedLedger() {
    const lastEvent = await this.stellarEventRepository.findOne({
      where: {},
      order: { ledger: 'DESC' },
    });

    if (lastEvent) {
      this.lastProcessedLedger = lastEvent.ledger;
      this.logger.log(`Resuming from ledger: ${this.lastProcessedLedger}`);
    } else {
      // Start from a configurable ledger or current
      const startLedger = this.configService.get<number>(
        'STELLAR_START_LEDGER',
        0,
      );
      this.lastProcessedLedger = startLedger;
      this.logger.log(`Starting from ledger: ${this.lastProcessedLedger}`);
    }
  }

  private async pollEvents() {
    let delay = 10000;
    while (this.isRunning) {
      try {
        await this.processNewEvents();
        delay = 10000;
        this.reconnectAttempts = 0;
        await this.sleep(delay, this.abortController?.signal);
      } catch (error) {
        if ((error as Error).name === 'AbortError') break;
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxReconnectAttempts) {
          this.logger.error(
            `Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping event listener.`,
          );
          this.isRunning = false;
          break;
        }

        const backoffDelay =
          this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        this.logger.error(
          `Error during event polling: ${(error as Error).message}. Reconnecting in ${backoffDelay / 1000}s (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        );

        try {
          await this.sleep(backoffDelay, this.abortController?.signal);
        } catch (sleepErr) {
          if ((sleepErr as Error).name === 'AbortError') break;
        }
      }
    }
  }

  private async processNewEvents() {
    const latestLedgerResponse = await this.server.getLatestLedger();
    const latestLedger = latestLedgerResponse.sequence;

    if (latestLedger <= this.lastProcessedLedger) {
      return; // No new ledgers to process
    }

    this.logger.debug(
      `Processing ledgers ${this.lastProcessedLedger + 1} to ${latestLedger}`,
    );

    await this.processLedgerRange(this.lastProcessedLedger + 1, latestLedger);
    this.lastProcessedLedger = latestLedger;
  }

  private async processLedgerRange(startLedger: number, endLedger: number) {
    try {
      const events = await this.getEventsForLedgerRange(startLedger, endLedger);

      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      this.logger.error(
        `Error processing ledger range ${startLedger}-${endLedger}:`,
        error,
      );
    }
  }

  private async getEventsForLedgerRange(
    startLedger: number,
    endLedger: number,
  ) {
    const allEvents: any[] = [];
    let currentStart = startLedger;

    try {
      while (currentStart <= endLedger) {
        // Soroban getEvents might have a limit on range
        const response = await this.server.getEvents({
          startLedger: currentStart,
          filters: [
            {
              type: 'contract',
              contractIds: [this.contractId],
            },
          ],
          limit: 100,
        });

        if (!response.events || response.events.length === 0) {
          break;
        }

        let index = 0;
        let lastTxHash = '';
        for (const event of response.events) {
          if (event.txHash === lastTxHash) {
            index++;
          } else {
            index = 0;
            lastTxHash = event.txHash;
          }

          allEvents.push({
            txHash: event.txHash,
            eventIndex: index,
            event: event,
            ledger: event.ledger,
            timestamp: new Date(event.ledgerClosedAt),
          });
        }

        // Update currentStart based on last event ledger or just break if we reached endLedger
        const lastLedger = response.events[response.events.length - 1].ledger;
        if (lastLedger >= endLedger) break;
        currentStart = lastLedger + 1;

        if (response.events.length < 100) break;
      }
    } catch (error) {
      this.logger.error(
        `Failed to get Soroban events for range ${startLedger}-${endLedger}:`,
        error,
      );
    }

    return allEvents;
  }

  private isContractEvent(event: any): boolean {
    return event.contractId === this.contractId;
  }

  private async processEvent(eventData: any) {
    try {
      const { txHash, eventIndex, event, ledger, timestamp } = eventData;

      // Check for idempotency
      const existingEvent = await this.stellarEventRepository.findOne({
        where: { txHash, eventIndex },
      });

      if (existingEvent) {
        this.logger.debug(`Event already processed: ${txHash}:${eventIndex}`);
        return;
      }

      // Parse and normalize the event
      const normalizedEvent = await this.normalizeEvent(
        event,
        txHash,
        eventIndex,
        ledger,
        timestamp,
      );

      // Save the normalized event
      await this.stellarEventRepository.save(normalizedEvent);

      // Update related escrow records
      await this.updateEscrowFromEvent(normalizedEvent);

      this.logger.debug(
        `Processed event: ${normalizedEvent.eventType} for escrow: ${normalizedEvent.escrowId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing event ${eventData.txHash}:${eventData.eventIndex}:`,
        error,
      );
    }
  }

  private async normalizeEvent(
    event: any,
    txHash: string,
    eventIndex: number,
    ledger: number,
    timestamp: Date,
  ): Promise<StellarEvent> {
    const eventType = this.mapEventType(event);
    const extractedFields = await this.extractEventFields(event, eventType);

    // Compute monotonic cursor: composite of ledger and eventIndex
    // Format: ledger * 1000 + eventIndex to ensure uniqueness within ledger
    const cursor = (
      BigInt(ledger) * BigInt(1000) +
      BigInt(eventIndex)
    ).toString();

    return this.stellarEventRepository.create({
      txHash,
      eventIndex,
      eventType,
      escrowId: extractedFields.escrowId,
      ledger,
      timestamp,
      rawPayload: event,
      extractedFields,
      amount: extractedFields.amount,
      assetCode: extractedFields.assetCode,
      assetIssuer: extractedFields.assetIssuer,
      milestoneIndex: extractedFields.milestoneIndex,
      fromAddress: extractedFields.fromAddress,
      toAddress: extractedFields.toAddress,
      reason: extractedFields.reason,
      cursor,
    });
  }

  private async extractEventFields(
    event: any,
    eventType: StellarEventType,
  ): Promise<Record<string, any>> {
    const fields: Record<string, any> = {};

    try {
      // Soroban event structure in getEvents response:
      // event.topic: Array of ScVal (XDR base64)
      // event.value: ScVal (XDR base64)

      const topics = event.topic.map((t: string) =>
        xdr.ScVal.fromXDR(t, 'base64'),
      );
      const value = xdr.ScVal.fromXDR(event.value, 'base64');

      // First topic is always the event name (Symbol)
      // Second topic is usually the escrow ID (U64)
      if (topics.length > 1) {
        fields.escrowId = topics[1].u64().low.toString();
      }

      switch (eventType) {
        case StellarEventType.ESCROW_CREATED: {
          const createdVec = value.vec();
          if (createdVec) {
            fields.fromAddress = Address.fromScVal(createdVec[0]).toString();
            fields.toAddress = Address.fromScVal(createdVec[1]).toString();

            const milestonesVec = createdVec[3].vec();
            if (milestonesVec) {
              let totalAmount = 0;
              milestonesVec.forEach((m: any) => {
                const map = m.map();
                if (map) {
                  map.forEach((entry: any) => {
                    const keySym = entry.key().sym().toString();
                    if (keySym === 'amount') {
                      totalAmount += Number(entry.val().i128().lo().toString());
                    }
                  });
                }
              });

              const tokenContractId = Address.fromScVal(
                createdVec[2],
              ).toString();
              let decimals = 7;
              const asset = await this.getAssetByContractId(tokenContractId);
              if (asset) {
                fields.assetCode = asset.code;
                fields.assetIssuer = asset.issuer;
                decimals = asset.decimals;
              } else {
                fields.assetCode =
                  tokenContractId ===
                  'CDLZFC3SYJYDZT7K67VZ75YJFCGSN5W4B77T2YI2EHCWH6I6D6LNCU6B'
                    ? 'XLM'
                    : 'UNKNOWN';
              }
              fields.amount = totalAmount / Math.pow(10, decimals);
            }
          }
          break;
        }

        case StellarEventType.ESCROW_FUNDED:
          // Value: funder (Address)
          fields.fromAddress = Address.fromScVal(value).toString();
          break;

        case StellarEventType.MILESTONE_RELEASED: {
          // Topics: [Symbol("milestone_released"), escrow_id, milestone_index]
          // Value: amount (i128)
          fields.milestoneIndex = topics[2].u32();
          const amountParts = value.i128();
          fields.amount = amountParts.lo().toString();
          break;
        }

        case StellarEventType.ESCROW_COMPLETED:
        case StellarEventType.ESCROW_CANCELLED:
          // Value: ()
          break;

        case StellarEventType.DISPUTE_CREATED:
          // Topics: [Symbol("dispute_raised"), escrow_id, caller]
          fields.fromAddress = Address.fromScVal(topics[2]).toString();
          break;

        case StellarEventType.DISPUTE_RESOLVED:
          // Topics: [Symbol("dispute_resolved"), escrow_id, winner]
          fields.toAddress = Address.fromScVal(topics[2]).toString();
          // Value: split_winner_amount (Option<i128>)
          if (value.switch() === xdr.ScValType.scvVec()) {
            const vec = value.vec();
            if (vec && vec.length > 0) {
              fields.amount = Number(vec[0].i128().lo().toString());
            }
          }
          break;
      }
    } catch (error) {
      this.logger.error(`Error extracting fields from Soroban event:`, error);
    }

    return fields;
  }

  private async getAssetByContractId(
    contractAddress: string,
  ): Promise<AllowedAsset | null> {
    const assets = await this.stellarEventRepository.manager
      .getRepository(AllowedAsset)
      .find({
        where: { active: true },
      });

    const networkPassphrase =
      this.configService.get<string>('stellar.networkPassphrase') ||
      'Test SDF Network ; September 2015';

    for (const asset of assets) {
      let assetContractId: string;
      if (asset.code === 'XLM') {
        assetContractId =
          'CDLZFC3SYJYDZT7K67VZ75YJFCGSN5W4B77T2YI2EHCWH6I6D6LNCU6B';
      } else {
        const stellarAsset = new Asset(asset.code, asset.issuer);
        assetContractId = stellarAsset.contractId(networkPassphrase);
      }

      if (assetContractId === contractAddress) {
        return asset;
      }
    }
    return null;
  }

  private mapEventType(event: any): StellarEventType {
    try {
      const topic0 = xdr.ScVal.fromXDR(event.topic[0], 'base64');
      const eventName = topic0.sym().toString();

      switch (eventName) {
        case 'escrow_created':
          return StellarEventType.ESCROW_CREATED;
        case 'escrow_funded':
          return StellarEventType.ESCROW_FUNDED;
        case 'milestone_released':
          return StellarEventType.MILESTONE_RELEASED;
        case 'escrow_completed':
          return StellarEventType.ESCROW_COMPLETED;
        case 'escrow_cancelled':
          return StellarEventType.ESCROW_CANCELLED;
        case 'dispute_raised': // Note: contract uses "dispute_raised"
          return StellarEventType.DISPUTE_CREATED;
        case 'dispute_resolved':
          return StellarEventType.DISPUTE_RESOLVED;
        default:
          this.logger.warn(`Unknown Soroban event topic: ${eventName}`);
          return eventName as any;
      }
    } catch (error) {
      this.logger.error('Error mapping event type:', error);
      return 'unknown' as any;
    }
  }

  private async updateEscrowFromEvent(event: StellarEvent) {
    if (!event.escrowId) {
      return; // No escrow ID to update
    }

    try {
      switch (event.eventType) {
        case StellarEventType.ESCROW_CREATED:
          await this.handleEscrowCreated(event);
          break;

        case StellarEventType.ESCROW_FUNDED:
          await this.handleEscrowFunded(event);
          break;

        case StellarEventType.MILESTONE_RELEASED:
          this.handleMilestoneReleased(event);
          break;

        case StellarEventType.ESCROW_COMPLETED:
          await this.handleEscrowCompleted(event);
          break;

        case StellarEventType.ESCROW_CANCELLED:
          await this.handleEscrowCancelled(event);
          break;

        case StellarEventType.DISPUTE_CREATED:
          await this.handleDisputeCreated(event);
          break;

        case StellarEventType.DISPUTE_RESOLVED:
          await this.handleDisputeResolved(event);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error updating escrow from event ${event.eventType}:`,
        error,
      );
    }
  }

  private async checkStateMismatch(
    escrowId: string,
    expectedStatus: EscrowStatus,
  ) {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
    });
    if (escrow && escrow.status !== expectedStatus) {
      this.logger.warn(
        `State mismatch detected for escrow ${escrowId}: DB status is '${escrow.status}', but on-chain event indicates status should be '${expectedStatus}'.`,
      );
      try {
        await this.consistencyChecker.checkConsistency({
          escrowIds: [Number(escrowId)],
        });
      } catch (err) {
        this.logger.error(
          `Failed to run consistency check for escrow ${escrowId}:`,
          err,
        );
      }
    }
  }

  private async handleEscrowCreated(event: StellarEvent) {
    if (!event.escrowId) return;
    // Check if escrow already exists
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (!escrow) {
      // Create new escrow from event data
      const newEscrow = this.escrowRepository.create({
        id: event.escrowId,
        title: `Escrow ${event.escrowId}`, // Extract from event if available
        amount: event.amount || 0,
        assetCode: event.assetCode || 'XLM',
        assetIssuer: event.assetIssuer || null,
        status: EscrowStatus.PENDING,
        creatorId: event.fromAddress, // This would need to be mapped to user ID
        isActive: true,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      } as any);

      await this.escrowRepository.save(newEscrow);
      this.logger.log(`Created new escrow from blockchain: ${event.escrowId}`);
    } else {
      await this.checkStateMismatch(event.escrowId, EscrowStatus.PENDING);
    }
  }

  private async handleEscrowFunded(event: StellarEvent) {
    if (!event.escrowId) return;
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow) {
      await this.checkStateMismatch(event.escrowId, EscrowStatus.ACTIVE);
      if (escrow.status === EscrowStatus.PENDING) {
        escrow.status = EscrowStatus.ACTIVE;
        await this.escrowRepository.save(escrow);
        this.logger.log(`Updated escrow status to ACTIVE: ${event.escrowId}`);
      }
    }
  }

  private handleMilestoneReleased(event: StellarEvent): void {
    // This would update milestone-specific data
    // For now, just log the event
    this.logger.log(
      `Milestone released for escrow: ${event.escrowId}, milestone: ${event.milestoneIndex}`,
    );
  }

  private async handleEscrowCompleted(event: StellarEvent) {
    if (!event.escrowId) return;
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow) {
      await this.checkStateMismatch(event.escrowId, EscrowStatus.COMPLETED);
      if (!this.isTerminalStatus(escrow.status)) {
        escrow.status = EscrowStatus.COMPLETED;
        escrow.isActive = false;
        await this.escrowRepository.save(escrow);
        this.logger.log(`Completed escrow: ${event.escrowId}`);
      }
    }
  }

  private async handleEscrowCancelled(event: StellarEvent) {
    if (!event.escrowId) return;
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow) {
      await this.checkStateMismatch(event.escrowId, EscrowStatus.CANCELLED);
      if (!this.isTerminalStatus(escrow.status)) {
        escrow.status = EscrowStatus.CANCELLED;
        escrow.isActive = false;
        await this.escrowRepository.save(escrow);
        this.logger.log(`Cancelled escrow: ${event.escrowId}`);
      }
    }
  }

  private async handleDisputeCreated(event: StellarEvent) {
    if (!event.escrowId) return;
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow) {
      await this.checkStateMismatch(event.escrowId, EscrowStatus.DISPUTED);
      if (escrow.status === EscrowStatus.ACTIVE) {
        escrow.status = EscrowStatus.DISPUTED;
        await this.escrowRepository.save(escrow);
        this.logger.log(`Escrow disputed: ${event.escrowId}`);
      }
    }
  }

  private async handleDisputeResolved(event: StellarEvent) {
    if (!event.escrowId) return;
    this.logger.log(`Dispute resolved for escrow: ${event.escrowId}`);
    try {
      await this.consistencyChecker.checkConsistency({
        escrowIds: [Number(event.escrowId)],
      });
    } catch (err) {
      this.logger.error(
        `Failed to trigger consistency check after dispute resolved:`,
        err,
      );
    }
  }

  private isTerminalStatus(status: EscrowStatus): boolean {
    return [EscrowStatus.COMPLETED, EscrowStatus.CANCELLED].includes(status);
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const err = new Error('AbortError');
        err.name = 'AbortError';
        reject(err);
        return;
      }

      const timeout = setTimeout(resolve, ms);

      signal?.addEventListener('abort', () => {
        clearTimeout(timeout);
        const err = new Error('AbortError');
        err.name = 'AbortError';
        reject(err);
      });
    });
  }

  // Public methods for external control
  async syncFromLedger(ledger: number): Promise<void> {
    this.lastProcessedLedger = ledger - 1;
    this.logger.log(`Manual sync requested from ledger: ${ledger}`);
    await this.processNewEvents();
  }

  getSyncStatus(): {
    isRunning: boolean;
    lastProcessedLedger: number;
    reconnectAttempts: number;
  } {
    return {
      isRunning: this.isRunning,
      lastProcessedLedger: this.lastProcessedLedger,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
