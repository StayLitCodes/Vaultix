import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { Party, PartyRole } from '../entities/party.entity';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { EscrowGateway } from '../../../gateways/escrow.gateway';
import { NotificationService } from '../../../notifications/notifications.service';
import { NotificationEventType } from '../../../notifications/enums/notification-event.enum';

/** Advisory lock key to prevent concurrent refund processing runs. */
const REFUND_LOCK_KEY = 'escrow_expiration_refund_lock';

/** In-memory set used as an advisory lock (single-instance deployments). */
const processingLock = new Set<string>();

/**
 * Represents an escrow queued for manual review after automated refund failure.
 */
export interface ManualRefundQueueItem {
  escrowId: string;
  reason: string;
  failedAt: Date;
  lastError: string;
}

/**
 * EscrowExpirationService
 *
 * Runs every 5 minutes to detect ACTIVE escrows whose deadline has passed and
 * trigger automatic on-chain refunds via the Soroban `refund_expired` function.
 *
 * Acceptance criteria implemented:
 * - Cron every 5 minutes
 * - Query Active escrows where expiresAt < NOW()
 * - Validate eligibility: Active status, balance > 0, no dispute
 * - Create Stellar refund transaction via EscrowStellarIntegrationService
 * - Calculate remaining balance minus platform fee (handled on-chain by BPS)
 * - Update status to Refunded in DB
 * - Emit WebSocket event `escrow:refunded`
 * - Notifications for buyer and seller
 * - Log all refund operations with tx hash
 * - Advisory locks to prevent duplicate processing
 * - Retry once on Stellar failure, then queue for MANUAL_REFUND
 * - MANUAL_REFUND queue for failed auto-refunds
 */
@Injectable()
export class EscrowExpirationService {
  private readonly logger = new Logger(EscrowExpirationService.name);

  /** In-memory MANUAL_REFUND queue for failed auto-refunds. */
  private readonly manualRefundQueue: ManualRefundQueueItem[] = [];

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(EscrowEvent)
    private readonly escrowEventRepository: Repository<EscrowEvent>,
    @InjectRepository(Party)
    private readonly partyRepository: Repository<Party>,
    private readonly escrowStellarIntegration: EscrowStellarIntegrationService,
    private readonly escrowGateway: EscrowGateway,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------------------
  // Cron job
  // ---------------------------------------------------------------------------

  /**
   * Runs every 5 minutes.
   * Acquires an advisory lock to prevent duplicate runs on overlapping schedules,
   * then processes all eligible expired escrows.
   */
  @Cron('0 */5 * * * *')
  async handleEscrowExpirations(): Promise<void> {
    if (processingLock.has(REFUND_LOCK_KEY)) {
      this.logger.warn(
        'Skipping escrow expiration run — previous run still in progress',
      );
      return;
    }

    processingLock.add(REFUND_LOCK_KEY);
    this.logger.log('Starting escrow expiration refund processing...');

    try {
      const expired = await this.findEligibleExpiredEscrows();
      this.logger.log(
        `Found ${expired.length} eligible expired escrow(s) to refund`,
      );

      for (const escrow of expired) {
        await this.processRefundWithLock(escrow);
      }
    } catch (error) {
      this.logger.error(
        'Unexpected error during escrow expiration processing',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      processingLock.delete(REFUND_LOCK_KEY);
      this.logger.log('Completed escrow expiration refund processing');
    }
  }

  // ---------------------------------------------------------------------------
  // Public helpers (admin / manual trigger)
  // ---------------------------------------------------------------------------

  /**
   * Manually trigger a refund for a single escrow — useful for admin endpoints
   * or for re-processing escrows in the MANUAL_REFUND queue.
   */
  async processRefundManually(escrowId: string): Promise<void> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['parties', 'parties.user'],
    });

    if (!escrow) {
      throw new Error(`Escrow ${escrowId} not found`);
    }

    const eligibility = this.checkEligibility(escrow);
    if (!eligibility.eligible) {
      throw new Error(
        `Escrow ${escrowId} is not eligible for refund: ${eligibility.reason}`,
      );
    }

    await this.processRefundWithLock(escrow);
  }

  /** Returns a copy of the current MANUAL_REFUND queue. */
  getManualRefundQueue(): ManualRefundQueueItem[] {
    return [...this.manualRefundQueue];
  }

  /** Removes an item from the MANUAL_REFUND queue by escrowId. */
  removeFromManualRefundQueue(escrowId: string): boolean {
    const idx = this.manualRefundQueue.findIndex(
      (item) => item.escrowId === escrowId,
    );
    if (idx === -1) return false;
    this.manualRefundQueue.splice(idx, 1);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Private: query + eligibility
  // ---------------------------------------------------------------------------

  private async findEligibleExpiredEscrows(): Promise<Escrow[]> {
    const now = new Date();

    return this.escrowRepository.find({
      where: {
        status: EscrowStatus.ACTIVE,
        expiresAt: LessThan(now),
        isActive: true,
      },
      relations: ['parties', 'parties.user'],
    });
  }

  private checkEligibility(escrow: Escrow): {
    eligible: boolean;
    reason?: string;
  } {
    // Must be ACTIVE
    if (escrow.status !== EscrowStatus.ACTIVE) {
      return {
        eligible: false,
        reason: `Status is ${escrow.status}, expected ACTIVE`,
      };
    }

    // Deadline must have passed
    const now = new Date();
    if (!escrow.expiresAt || escrow.expiresAt > now) {
      return { eligible: false, reason: 'Deadline has not passed yet' };
    }

    // Balance > 0 — remaining = amount - releasedAmount
    const remaining = Number(escrow.amount) - Number(escrow.releasedAmount);
    if (remaining <= 0) {
      return { eligible: false, reason: 'No remaining balance to refund' };
    }

    return { eligible: true };
  }

  // ---------------------------------------------------------------------------
  // Private: per-escrow advisory lock + retry
  // ---------------------------------------------------------------------------

  private async processRefundWithLock(escrow: Escrow): Promise<void> {
    const lockKey = `refund:${escrow.id}`;

    // Per-escrow advisory lock to prevent duplicate concurrent processing
    if (processingLock.has(lockKey)) {
      this.logger.warn(
        `Skipping escrow ${escrow.id} — already being processed`,
      );
      return;
    }

    processingLock.add(lockKey);

    try {
      await this.executeRefundWithRetry(escrow);
    } finally {
      processingLock.delete(lockKey);
    }
  }

  /**
   * Attempt the Stellar refund once; on failure retry once more.
   * If both attempts fail, queue for MANUAL_REFUND.
   */
  private async executeRefundWithRetry(escrow: Escrow): Promise<void> {
    // Re-fetch to get the freshest state (avoid stale data from batch load)
    const fresh = await this.escrowRepository.findOne({
      where: { id: escrow.id },
      relations: ['parties', 'parties.user'],
    });

    if (!fresh) {
      this.logger.warn(`Escrow ${escrow.id} disappeared before refund`);
      return;
    }

    const eligibility = this.checkEligibility(fresh);
    if (!eligibility.eligible) {
      this.logger.log(
        `Escrow ${fresh.id} skipped: ${eligibility.reason ?? 'not eligible'}`,
      );
      return;
    }

    let txHash: string | null = null;
    let lastError: Error | null = null;

    // First attempt
    try {
      txHash = await this.triggerOnChainRefund(fresh);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      this.logger.warn(
        `First refund attempt failed for escrow ${fresh.id}: ${lastError.message}. Retrying once...`,
      );

      // Single retry
      try {
        txHash = await this.triggerOnChainRefund(fresh);
        lastError = null;
      } catch (retryErr) {
        lastError =
          retryErr instanceof Error ? retryErr : new Error(String(retryErr));
        this.logger.error(
          `Retry also failed for escrow ${fresh.id}: ${lastError.message}`,
        );
      }
    }

    if (txHash) {
      await this.finaliseRefund(fresh, txHash);
    } else {
      await this.queueForManualRefund(
        fresh,
        lastError?.message ?? 'Unknown error after retry',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private: on-chain call
  // ---------------------------------------------------------------------------

  private async triggerOnChainRefund(escrow: Escrow): Promise<string> {
    const platformWallet = this.configService.get<string>(
      'PLATFORM_WALLET_PUBLIC_KEY',
      '',
    );

    if (!platformWallet) {
      throw new Error(
        'PLATFORM_WALLET_PUBLIC_KEY is not configured — cannot sign refund transaction',
      );
    }

    return this.escrowStellarIntegration.refundExpiredOnChain(
      escrow.id,
      platformWallet,
    );
  }

  // ---------------------------------------------------------------------------
  // Private: post-refund DB update + notifications
  // ---------------------------------------------------------------------------

  private async finaliseRefund(escrow: Escrow, txHash: string): Promise<void> {
    const remaining = Number(escrow.amount) - Number(escrow.releasedAmount);

    // Compute platform fee amount for logging/notifications (BPS from config)
    const feeBps = this.configService.get<number>('PLATFORM_FEE_BPS', 0);
    const platformFee = Math.floor((remaining * feeBps) / 10_000);
    const refundedTobuyer = remaining - platformFee;

    // Persist status change + released amount atomically in a DB transaction
    await this.dataSource.transaction(async (manager) => {
      await manager.update(Escrow, escrow.id, {
        status: EscrowStatus.REFUNDED,
        isActive: false,
        releasedAmount: escrow.amount, // mark full amount as released
        releaseTransactionHash: txHash,
      });

      await manager.save(EscrowEvent, {
        escrowId: escrow.id,
        eventType: EscrowEventType.REFUNDED,
        data: {
          txHash,
          remainingBalance: remaining,
          platformFee,
          refundedAmount: refundedTobuyer,
          feeBps,
          refundedAt: new Date().toISOString(),
        },
      });
    });

    this.logger.log(
      `Escrow ${escrow.id} refunded — tx: ${txHash}, amount: ${refundedTobuyer}, fee: ${platformFee}`,
    );

    // WebSocket broadcast
    this.escrowGateway.broadcastEscrowRefunded(escrow.id, {
      txHash,
      refundedAmount: refundedTobuyer,
      platformFee,
      feeBps,
    });

    // In-app notifications for buyer and seller
    await this.notifyParties(escrow, txHash, refundedTobuyer, platformFee);
  }

  private async queueForManualRefund(
    escrow: Escrow,
    errorMessage: string,
  ): Promise<void> {
    // Only add once
    const alreadyQueued = this.manualRefundQueue.some(
      (item) => item.escrowId === escrow.id,
    );

    if (!alreadyQueued) {
      this.manualRefundQueue.push({
        escrowId: escrow.id,
        reason: 'Stellar transaction failed after retry',
        failedAt: new Date(),
        lastError: errorMessage,
      });
    }

    // Log event in DB
    try {
      await this.escrowEventRepository.save({
        escrowId: escrow.id,
        eventType: EscrowEventType.QUEUED_MANUAL_REFUND,
        data: {
          error: errorMessage,
          queuedAt: new Date().toISOString(),
        },
      });
    } catch (dbErr) {
      this.logger.error(
        `Failed to log QUEUED_MANUAL_REFUND event for escrow ${escrow.id}`,
        dbErr instanceof Error ? dbErr.stack : String(dbErr),
      );
    }

    this.logger.error(
      `Escrow ${escrow.id} queued for MANUAL_REFUND after auto-refund failure: ${errorMessage}`,
    );

    // Notify buyer that the automatic refund failed and is under manual review
    await this.notifyPartiesRefundFailed(escrow, errorMessage);
  }

  // ---------------------------------------------------------------------------
  // Private: notifications
  // ---------------------------------------------------------------------------

  private async notifyParties(
    escrow: Escrow,
    txHash: string,
    refundedAmount: number,
    platformFee: number,
  ): Promise<void> {
    const buyer = escrow.parties?.find((p) => p.role === PartyRole.BUYER);
    const seller = escrow.parties?.find((p) => p.role === PartyRole.SELLER);

    const payload = {
      escrowId: escrow.id,
      escrowTitle: escrow.title,
      txHash,
      refundedAmount,
      platformFee,
      refundedAt: new Date().toISOString(),
    };

    if (buyer) {
      try {
        await this.notificationService.handleEscrowEvent(
          buyer.userId,
          NotificationEventType.ESCROW_REFUNDED,
          { ...payload, role: 'buyer' },
        );
      } catch (err) {
        this.logger.error(
          `Failed to notify buyer ${buyer.userId} for escrow ${escrow.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    if (seller) {
      try {
        await this.notificationService.handleEscrowEvent(
          seller.userId,
          NotificationEventType.ESCROW_REFUNDED,
          { ...payload, role: 'seller' },
        );
      } catch (err) {
        this.logger.error(
          `Failed to notify seller ${seller.userId} for escrow ${escrow.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async notifyPartiesRefundFailed(
    escrow: Escrow,
    errorMessage: string,
  ): Promise<void> {
    const buyer = escrow.parties?.find((p) => p.role === PartyRole.BUYER);

    if (buyer) {
      try {
        await this.notificationService.handleEscrowEvent(
          buyer.userId,
          NotificationEventType.ESCROW_REFUND_FAILED,
          {
            escrowId: escrow.id,
            escrowTitle: escrow.title,
            error: errorMessage,
            failedAt: new Date().toISOString(),
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to notify buyer ${buyer.userId} of refund failure for escrow ${escrow.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }
}
