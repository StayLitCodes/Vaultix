/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Horizon } from '@stellar/stellar-sdk';
import {
  StellarEvent,
  StellarEventType,
} from '../entities/stellar-event.entity';
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';

@Injectable()
export class StellarEventListenerService implements OnModuleInit {
  private readonly logger = new Logger(StellarEventListenerService.name);
  private server: any;
  private contractId: string;
  private isRunning = false;
  private lastProcessedLedger = 0;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds

  constructor(
    private configService: ConfigService,
    @InjectRepository(StellarEvent)
    private stellarEventRepository: Repository<StellarEvent>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
  ) {}

  async onModuleInit() {
    const contractId = this.configService.get<string>('STELLAR_CONTRACT_ID');
    const rpcUrl = this.configService.get<string>('STELLAR_RPC_URL');

    if (!contractId || !rpcUrl) {
      this.logger.error(
        'Missing required configuration: STELLAR_CONTRACT_ID or STELLAR_RPC_URL',
      );
      return;
    }

    this.contractId = contractId;
    this.server = new (Horizon as any).Server(rpcUrl);
    await this.startEventListener();
  }

  async startEventListener() {
    if (this.isRunning) {
      this.logger.warn('Event listener is already running');
      return;
    }

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
      this.logger.error('Failed to start event listener:', error);
      this.isRunning = false;
      await this.handleReconnection();
    }
  }

  async stopEventListener() {
    this.isRunning = false;
    this.logger.log('Stopped Stellar event listener');
  }

  private async initializeLastProcessedLedger() {
    const lastEvent = await this.stellarEventRepository.findOne({
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
        await this.sleep(5000); // Poll every 5 seconds
      } catch (error) {
        this.logger.error('Error during event polling:', error);
        await this.handleReconnection();
      }
    }
  }

  private async processNewEvents() {
    const latestLedger = await this.server.latestLedger();

    if (latestLedger.sequence <= this.lastProcessedLedger) {
      return; // No new ledgers to process
    }

    this.logger.debug(
      `Processing ledgers ${this.lastProcessedLedger + 1} to ${latestLedger.sequence}`,
    );

    // Process events in batches to avoid overwhelming the system
    const batchSize = 100;
    let currentLedger = this.lastProcessedLedger + 1;

    while (currentLedger <= latestLedger.sequence && this.isRunning) {
      const endLedger = Math.min(
        currentLedger + batchSize - 1,
        latestLedger.sequence,
      );

      await this.processLedgerRange(currentLedger, endLedger);
      currentLedger = endLedger + 1;
    }

    this.lastProcessedLedger = latestLedger.sequence;
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
    // This would use the actual Stellar SDK to get events
    // For now, we'll simulate the structure
    const events: any[] = [];

    try {
      // Get events for the contract in the ledger range
      const ledgerPage = await this.server
        .ledgers()
        .cursor(startLedger.toString())
        .limit(endLedger - startLedger + 1)
        .call();

      for (const ledger of ledgerPage.records) {
        // Parse contract events from the ledger
        const contractEvents = await this.extractContractEvents(ledger);
        events.push(...contractEvents);
      }
    } catch (error) {
      this.logger.error(
        `Failed to get events for range ${startLedger}-${endLedger}:`,
        error,
      );
    }

    return events;
  }

  private async extractContractEvents(ledger: any): Promise<any[]> {
    // This is a placeholder for actual Soroban event extraction
    // In reality, this would parse the transaction results for contract events
    const events: any[] = [];

    try {
      // Simulate finding contract events in the ledger
      // This would need to be implemented with actual Stellar SDK calls
      const transactions = ledger.transactions || [];

      for (const tx of transactions) {
        if (tx.resultMeta && tx.resultMeta.events) {
          for (let i = 0; i < tx.resultMeta.events.length; i++) {
            const event = tx.resultMeta.events[i];

            // Check if this event is from our contract
            if (this.isContractEvent(event)) {
              events.push({
                txHash: tx.hash,
                eventIndex: i,
                event,
                ledger: ledger.sequence,
                timestamp: new Date(ledger.closed_at),
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('Error extracting contract events:', error);
    }

    return events;
  }

  private isContractEvent(event: any): boolean {
    // Check if the event is from our contract
    // This would need to be implemented based on actual event structure
    return (
      event.contractId === this.contractId ||
      (event.type &&
        event.type.includes('contract') &&
        event.contractId === this.contractId)
    );
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
    const extractedFields = this.extractEventFields(event, eventType);

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

  private mapEventType(event: any): StellarEventType {
    // Map Stellar contract events to our internal event types
    const eventName = event.type || event.name || event.topic;

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
      case 'dispute_created':
        return StellarEventType.DISPUTE_CREATED;
      case 'dispute_resolved':
        return StellarEventType.DISPUTE_RESOLVED;
      default:
        this.logger.warn(`Unknown event type: ${eventName}`);
        return eventName as StellarEventType;
    }
  }

  private extractEventFields(
    event: Record<string, any>,
    eventType: StellarEventType,
  ): Record<string, any> {
    const fields: Record<string, any> = {};

    try {
      // Extract common fields based on event type
      switch (eventType) {
        case StellarEventType.ESCROW_CREATED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.amount = event.body?.amount || event.value?.amount;
          fields.asset = event.body?.asset || event.value?.asset;
          fields.fromAddress = event.body?.creator || event.value?.creator;
          break;

        case StellarEventType.ESCROW_FUNDED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.amount = event.body?.amount || event.value?.amount;
          fields.asset = event.body?.asset || event.value?.asset;
          fields.fromAddress = event.body?.funder || event.value?.funder;
          break;

        case StellarEventType.MILESTONE_RELEASED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.milestoneIndex =
            event.body?.milestone_index || event.value?.milestone_index;
          fields.amount = event.body?.amount || event.value?.amount;
          fields.toAddress = event.body?.recipient || event.value?.recipient;
          break;

        case StellarEventType.ESCROW_COMPLETED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.toAddress = event.body?.recipient || event.value?.recipient;
          break;

        case StellarEventType.ESCROW_CANCELLED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.reason = event.body?.reason || event.value?.reason;
          break;

        case StellarEventType.DISPUTE_CREATED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.fromAddress = event.body?.disputant || event.value?.disputant;
          fields.reason = event.body?.reason || event.value?.reason;
          break;

        case StellarEventType.DISPUTE_RESOLVED:
          fields.escrowId = event.body?.escrow_id || event.value?.escrow_id;
          fields.reason = event.body?.resolution || event.value?.resolution;
          break;
      }
    } catch (error) {
      this.logger.error(`Error extracting fields from event:`, error);
    }

    return fields;
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
