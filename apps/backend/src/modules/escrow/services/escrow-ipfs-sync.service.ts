import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Escrow } from '../entities/escrow.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { IpfsService } from '../../ipfs/ipfs.service';

/**
 * Service that automatically pins escrow metadata to IPFS at key lifecycle events
 */
@Injectable()
export class EscrowIpfsSyncService implements OnModuleInit {
  private readonly logger = new Logger(EscrowIpfsSyncService.name);
  private eventListenerInitialized = false;

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(EscrowEvent)
    private eventRepository: Repository<EscrowEvent>,
    private readonly ipfsService: IpfsService,
  ) {}

  onModuleInit() {
    if (!this.eventListenerInitialized) {
      this.eventListenerInitialized = true;
      this.logger.log('Escrow IPFS Sync Service initialized');
      // Start polling for new events every 2 seconds
      void this.startEventPolling();
    }
  }

  /**
   * Poll for new escrow events and trigger IPFS pinning
   * This runs in the background to avoid blocking main operations
   */
  private startEventPolling() {
    setInterval(() => {
      void this.processPendingEvents();
    }, 2000);
  }

  /**
   * Process events that need IPFS metadata pinning
   */
  private async processPendingEvents() {
    // Find recent events that might need IPFS sync
    const recentEvents = await this.eventRepository.find({
      where: {
        eventType: In([
          EscrowEventType.CREATED,
          EscrowEventType.FUNDED,
          EscrowEventType.COMPLETED,
          EscrowEventType.DISPUTED,
        ]),
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    for (const event of recentEvents) {
      await this.syncMetadataForEvent(event);
    }
  }

  /**
   * Sync metadata to IPFS for specific event types
   */
  private async syncMetadataForEvent(event: EscrowEvent) {
    const shouldSync = [
      EscrowEventType.CREATED,
      EscrowEventType.FUNDED,
      EscrowEventType.COMPLETED,
      EscrowEventType.DISPUTED,
    ].includes(event.eventType);

    if (!shouldSync) {
      return;
    }

    try {
      const escrow = await this.escrowRepository.findOne({
        where: { id: event.escrowId },
        relations: ['parties', 'conditions'],
      });

      if (!escrow) {
        return;
      }

      // Check if we need to pin (if escrow doesn't have IPFS data)
      const needsPinning = !escrow.ipfsCid;

      if (needsPinning) {
        this.logger.log(
          `Pinning metadata for escrow ${escrow.id} after ${event.eventType} event`,
        );

        // Pin metadata (this will update escrow.ipfsCid, ipfsMetadataHash, ipfsVersion)
        await this.ipfsService.pinMetadata(escrow.id, {
          status: escrow.status,
        });
      }
    } catch (error) {
      // Graceful failure - log but don't block
      this.logger.error(
        `Failed to sync IPFS metadata for escrow ${event.escrowId}`,
        error,
      );
    }
  }

  /**
   * Manually trigger IPFS metadata pinning for an escrow
   * Called by the admin endpoint
   */
  async triggerMetadataPin(
    escrowId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.ipfsService.pinMetadata(escrowId, metadata || {});
  }
}
