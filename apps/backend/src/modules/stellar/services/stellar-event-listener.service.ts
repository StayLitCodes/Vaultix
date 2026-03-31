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
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rpc, xdr, Address } from '@stellar/stellar-sdk';
import {
  StellarEvent,
  StellarEventType,
} from '../entities/stellar-event.entity';
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';
import { SorobanClientService } from '../../../services/stellar/soroban-client.service';

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
        await this.handleReconnection();
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
    while (this.isRunning) {
      try {
        await this.processNewEvents();
        await this.sleep(10000, this.abortController?.signal); // Poll every 10 seconds for Soroban
      } catch (error) {
        if ((error as Error).name === 'AbortError') break;
        this.logger.error('Error during event polling:', error);
        await this.handleReconnection();
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

        for (const event of response.events) {
          allEvents.push({
            txHash: event.txHash,
            eventIndex: 0, // Simplified as Soroban doesn't expose index easily in getEvents?
            ledger: event.ledger,
            timestamp: new Date(event.ledgerClosedAt),
            rawEvent: event,
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
      asset: extractedFields.asset,
      milestoneIndex: extractedFields.milestoneIndex,
      fromAddress: extractedFields.fromAddress,
      toAddress: extractedFields.toAddress,
      reason: extractedFields.reason,
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
          // Value: [depositor, recipient, token_address, milestones, deadline]
          const createdVec = value.vec();
          if (createdVec) {
            fields.fromAddress = Address.fromScVal(createdVec[0]).toString();
            fields.toAddress = Address.fromScVal(createdVec[1]).toString();
            // ... (milestones and other fields can be extracted if needed)
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
      }
    } catch (error) {
      this.logger.error(`Error extracting fields from Soroban event:`, error);
    }

    return fields;
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
          this.handleDisputeResolved(event);
          break;
      }
    } catch (error) {
      this.logger.error(
        `Error updating escrow from event ${event.eventType}:`,
        error,
      );
    }
  }

  private async handleEscrowCreated(event: StellarEvent) {
    // Check if escrow already exists
    let escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (!escrow) {
      // Create new escrow from event data
      escrow = this.escrowRepository.create({
        id: event.escrowId,
        title: `Escrow ${event.escrowId}`, // Extract from event if available
        amount: event.amount || 0,
        asset: event.asset || 'XLM',
        status: EscrowStatus.PENDING,
        creatorId: event.fromAddress, // This would need to be mapped to user ID
        isActive: true,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      });

      await this.escrowRepository.save(escrow);
      this.logger.log(`Created new escrow from blockchain: ${event.escrowId}`);
    }
  }

  private async handleEscrowFunded(event: StellarEvent) {
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow && escrow.status === EscrowStatus.PENDING) {
      escrow.status = EscrowStatus.ACTIVE;
      await this.escrowRepository.save(escrow);
      this.logger.log(`Updated escrow status to ACTIVE: ${event.escrowId}`);
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
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow && !this.isTerminalStatus(escrow.status)) {
      escrow.status = EscrowStatus.COMPLETED;
      escrow.isActive = false;
      await this.escrowRepository.save(escrow);
      this.logger.log(`Completed escrow: ${event.escrowId}`);
    }
  }

  private async handleEscrowCancelled(event: StellarEvent) {
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow && !this.isTerminalStatus(escrow.status)) {
      escrow.status = EscrowStatus.CANCELLED;
      escrow.isActive = false;
      await this.escrowRepository.save(escrow);
      this.logger.log(`Cancelled escrow: ${event.escrowId}`);
    }
  }

  private async handleDisputeCreated(event: StellarEvent) {
    const escrow = await this.escrowRepository.findOne({
      where: { id: event.escrowId },
    });

    if (escrow && escrow.status === EscrowStatus.ACTIVE) {
      escrow.status = EscrowStatus.DISPUTED;
      await this.escrowRepository.save(escrow);
      this.logger.log(`Escrow disputed: ${event.escrowId}`);
    }
  }

  private handleDisputeResolved(event: StellarEvent): void {
    // This would handle dispute resolution logic
    this.logger.log(`Dispute resolved for escrow: ${event.escrowId}`);
  }

  private isTerminalStatus(status: EscrowStatus): boolean {
    return [EscrowStatus.COMPLETED, EscrowStatus.CANCELLED].includes(status);
  }

  private async handleReconnection() {
    if (!this.isRunning) {
      return;
    }

    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.logger.error(
        'Max reconnection attempts reached. Stopping event listener.',
      );
      this.isRunning = false;
      return;
    }

    this.logger.warn(
      `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
    );
    await this.sleep(this.reconnectDelay);

    try {
      await this.startEventListener();
      this.reconnectAttempts = 0; // Reset on successful reconnection
    } catch (error) {
      this.logger.error('Reconnection failed:', error);
      await this.handleReconnection();
    }
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
