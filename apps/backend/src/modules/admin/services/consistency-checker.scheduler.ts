import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EscrowChainId,
  EscrowChainIdStatus,
} from '../../escrow/entities/escrow-chain-id.entity';
import { ConsistencyCheckerService } from './consistency-checker.service';
import stellarConfig from '../../../config/stellar.config';

const BATCH_SIZE = 50;

@Injectable()
export class ConsistencyCheckerScheduler {
  private readonly logger = new Logger(ConsistencyCheckerScheduler.name);
  private isRunning = false;
  private offset = 0;

  constructor(
    @Inject(stellarConfig.KEY)
    private readonly config: ConfigType<typeof stellarConfig>,
    @InjectRepository(EscrowChainId)
    private readonly chainIdRepository: Repository<EscrowChainId>,
    private readonly checker: ConsistencyCheckerService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcileNextBatch(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn(
        'Skipping consistency sweep; previous batch is still running',
      );
      return;
    }

    this.isRunning = true;
    try {
      const contractId = process.env.STELLAR_CONTRACT_ID;
      if (!contractId) {
        this.logger.debug(
          'Skipping consistency sweep; no Stellar contract is configured',
        );
        return;
      }

      const mappings = await this.chainIdRepository.find({
        where: {
          network: this.config.network,
          contractId,
          status: EscrowChainIdStatus.MAPPED,
        },
        order: { id: 'ASC' },
        skip: this.offset,
        take: BATCH_SIZE,
      });

      if (mappings.length === 0) {
        this.offset = 0;
        return;
      }

      const result = await this.checker.checkConsistency({
        escrowIds: mappings.map((mapping) => mapping.escrowId),
      });

      const inconsistent = result.summary.totalInconsistent;
      const missing =
        result.summary.totalMissingInDb + result.summary.totalMissingOnChain;
      const errored = result.summary.totalErrored;

      if (inconsistent || missing || errored) {
        this.logger.warn({
          msg: 'On-chain escrow consistency sweep found drift',
          offset: this.offset,
          checked: result.summary.totalChecked,
          inconsistent,
          missing,
          errored,
          reports: result.reports.filter((report) => !report.isConsistent),
        });
      } else {
        this.logger.log(
          `On-chain consistency sweep checked ${result.summary.totalChecked} escrows with no drift`,
        );
      }

      this.offset =
        mappings.length < BATCH_SIZE ? 0 : this.offset + mappings.length;
    } catch (error) {
      this.logger.error(
        `On-chain consistency sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
