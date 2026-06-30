import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';
import { Dispute, DisputeStatus, DisputeOutcome } from '../../escrow/entities/dispute.entity';
import { User } from '../../user/entities/user.entity';

export interface ChartData {
  labels: string[];
  values: number[];
}

export interface VolumeMetrics {
  totalVolume: number;
  averageAmount: number;
  medianAmount: number;
}

export interface ActivityMetrics {
  created: number;
  active: number;
  completed: number;
  disputed: number;
  cancelled: number;
  refunded: number;
  expired: number;
  total: number;
}

export interface PerformanceMetrics {
  avgTimeToFundingDays: number;
  avgTimeToCompletionDays: number;
  avgDisputeResolutionDays: number;
}

export interface UserMetrics {
  total: number;
  active30d: number;
  new7d: number;
  new30d: number;
  new90d: number;
}

export interface DisputeMetrics {
  totalDisputes: number;
  disputeRate: number;
  resolutionRate: number;
  avgResolutionTimeDays: number;
  winRate: number;
  outcomeDistribution: Record<string, number>;
}

export interface SummaryAnalytics {
  volume: VolumeMetrics;
  activity: ActivityMetrics;
  performance: PerformanceMetrics;
  users: UserMetrics;
  disputes: DisputeMetrics;
  generatedAt: string;
}

export interface VolumeStat {
  period: string;
  count: number;
  volume: number;
}

export interface VolumeTimeSeries {
  daily30d: ChartData;
  daily90d: ChartData;
  monthly12m: ChartData;
}

export interface UserTimeSeries {
  weeklyActive12w: ChartData;
}

export interface TopUser {
  walletAddress: string;
  escrowCount: number;
  totalVolume: number;
  completionRate: number;
}

@Injectable()
export class AnalyticsService {
  private cache = new Map<string, { data: unknown; expiry: number }>();
  private readonly SUMMARY_TTL = 5 * 60 * 1000;
  private readonly TIMESERIES_TTL = 15 * 60 * 1000;

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, { data, expiry: Date.now() + ttl });
  }

  private daysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  async getSummary(): Promise<SummaryAnalytics> {
    const cacheKey = 'analytics_summary';
    const cached = this.getFromCache<SummaryAnalytics>(cacheKey);
    if (cached) return cached;

    const [volume, activity, performance, users, disputes] = await Promise.all([
      this.getVolumeMetrics(),
      this.getActivityMetrics(),
      this.getPerformanceMetrics(),
      this.getUserMetrics(),
      this.getDisputeMetrics(),
    ]);

    const summary: SummaryAnalytics = {
      volume,
      activity,
      performance,
      users,
      disputes,
      generatedAt: new Date().toISOString(),
    };

    this.setCache(cacheKey, summary, this.SUMMARY_TTL);
    return summary;
  }

  async getVolumeMetrics(): Promise<VolumeMetrics> {
    const cacheKey = 'analytics_volume_metrics';
    const cached = this.getFromCache<VolumeMetrics>(cacheKey);
    if (cached) return cached;

    const rows = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('escrow.amount', 'amount')
      .where('escrow.status = :status', { status: EscrowStatus.COMPLETED })
      .getRawMany<{ amount: string }>();

    const amounts = rows.map((r) => parseFloat(r.amount || '0')).sort((a, b) => a - b);
    const total = amounts.reduce((sum, v) => sum + v, 0);
    const avg = amounts.length > 0 ? total / amounts.length : 0;

    let median = 0;
    if (amounts.length > 0) {
      const mid = Math.floor(amounts.length / 2);
      median =
        amounts.length % 2 !== 0
          ? amounts[mid]
          : (amounts[mid - 1] + amounts[mid]) / 2;
    }

    const metrics: VolumeMetrics = {
      totalVolume: parseFloat(total.toFixed(7)),
      averageAmount: parseFloat(avg.toFixed(7)),
      medianAmount: parseFloat(median.toFixed(7)),
    };

    this.setCache(cacheKey, metrics, this.SUMMARY_TTL);
    return metrics;
  }

  async getActivityMetrics(): Promise<ActivityMetrics> {
    const cacheKey = 'analytics_activity';
    const cached = this.getFromCache<ActivityMetrics>(cacheKey);
    if (cached) return cached;

    const rows = await this.escrowRepository
      .createQueryBuilder('escrow')
      .select('escrow.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('escrow.status')
      .getRawMany<{ status: string; count: string }>();

    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = parseInt(r.count);
      return acc;
    }, {});

    const metrics: ActivityMetrics = {
      created: counts[EscrowStatus.PENDING] ?? 0,
      active: counts[EscrowStatus.ACTIVE] ?? 0,
      completed: counts[EscrowStatus.COMPLETED] ?? 0,
      disputed: counts[EscrowStatus.DISPUTED] ?? 0,
      cancelled: counts[EscrowStatus.CANCELLED] ?? 0,
      refunded: counts[EscrowStatus.CANCELLED] ?? 0,
      expired: counts[EscrowStatus.EXPIRED] ?? 0,
      total: rows.reduce((sum, r) => sum + parseInt(r.count), 0),
    };

    this.setCache(cacheKey, metrics, this.SUMMARY_TTL);
    return metrics;
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cacheKey = 'analytics_performance';
    const cached = this.getFromCache<PerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const [fundingRaw, completionRaw, disputeRaw] = await Promise.all([
      this.escrowRepository
        .createQueryBuilder('escrow')
        .select(
          'AVG(julianday(escrow.fundedAt) - julianday(escrow.createdAt))',
          'avgDays',
        )
        .where('escrow.fundedAt IS NOT NULL')
        .getRawOne<{ avgDays: string | null }>(),
      this.escrowRepository
        .createQueryBuilder('escrow')
        .select(
          'AVG(julianday(escrow.updatedAt) - julianday(escrow.createdAt))',
          'avgDays',
        )
        .where('escrow.status = :status', { status: EscrowStatus.COMPLETED })
        .getRawOne<{ avgDays: string | null }>(),
      this.disputeRepository
        .createQueryBuilder('dispute')
        .select(
          'AVG(julianday(dispute.resolvedAt) - julianday(dispute.createdAt))',
          'avgDays',
        )
        .where('dispute.status = :status', { status: DisputeStatus.RESOLVED })
        .getRawOne<{ avgDays: string | null }>(),
    ]);

    const metrics: PerformanceMetrics = {
      avgTimeToFundingDays: parseFloat(
        parseFloat(fundingRaw?.avgDays || '0').toFixed(2),
      ),
      avgTimeToCompletionDays: parseFloat(
        parseFloat(completionRaw?.avgDays || '0').toFixed(2),
      ),
      avgDisputeResolutionDays: parseFloat(
        parseFloat(disputeRaw?.avgDays || '0').toFixed(2),
      ),
    };

    this.setCache(cacheKey, metrics, this.SUMMARY_TTL);
    return metrics;
  }

  async getUserMetrics(): Promise<UserMetrics> {
    const cacheKey = 'analytics_users';
    const cached = this.getFromCache<UserMetrics>(cacheKey);
    if (cached) return cached;

    const [total, active30d, new7d, new30d, new90d] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { updatedAt: MoreThan(this.daysAgo(30)) } }),
      this.userRepository.count({ where: { createdAt: MoreThan(this.daysAgo(7)) } }),
      this.userRepository.count({ where: { createdAt: MoreThan(this.daysAgo(30)) } }),
      this.userRepository.count({ where: { createdAt: MoreThan(this.daysAgo(90)) } }),
    ]);

    const metrics: UserMetrics = { total, active30d, new7d, new30d, new90d };
    this.setCache(cacheKey, metrics, this.SUMMARY_TTL);
    return metrics;
  }

  async getDisputeMetrics(): Promise<DisputeMetrics> {
    const cacheKey = 'analytics_disputes';
    const cached = this.getFromCache<DisputeMetrics>(cacheKey);
    if (cached) return cached;

    const [totalEscrows, totalDisputes, resolvedCount, outcomes, avgResolutionRaw, buyerWins] =
      await Promise.all([
        this.escrowRepository.count(),
        this.disputeRepository.count(),
        this.disputeRepository.count({ where: { status: DisputeStatus.RESOLVED } }),
        this.disputeRepository
          .createQueryBuilder('dispute')
          .select('dispute.outcome', 'outcome')
          .addSelect('COUNT(*)', 'count')
          .where('dispute.status = :status', { status: DisputeStatus.RESOLVED })
          .groupBy('dispute.outcome')
          .getRawMany<{ outcome: string | null; count: string }>(),
        this.disputeRepository
          .createQueryBuilder('dispute')
          .select(
            'AVG(julianday(dispute.resolvedAt) - julianday(dispute.createdAt))',
            'avgDays',
          )
          .where('dispute.status = :status', { status: DisputeStatus.RESOLVED })
          .getRawOne<{ avgDays: string | null }>(),
        this.disputeRepository.count({
          where: { status: DisputeStatus.RESOLVED, outcome: DisputeOutcome.REFUNDED_TO_BUYER },
        }),
      ]);

    const disputeRate = totalEscrows > 0 ? (totalDisputes / totalEscrows) * 100 : 0;
    const resolutionRate = totalDisputes > 0 ? (resolvedCount / totalDisputes) * 100 : 0;
    const winRate = resolvedCount > 0 ? (buyerWins / resolvedCount) * 100 : 0;

    const metrics: DisputeMetrics = {
      totalDisputes,
      disputeRate: parseFloat(disputeRate.toFixed(2)),
      resolutionRate: parseFloat(resolutionRate.toFixed(2)),
      avgResolutionTimeDays: parseFloat(
        parseFloat(avgResolutionRaw?.avgDays || '0').toFixed(2),
      ),
      winRate: parseFloat(winRate.toFixed(2)),
      outcomeDistribution: outcomes.reduce<Record<string, number>>(
        (acc, curr) => {
          if (curr.outcome) acc[curr.outcome] = parseInt(curr.count);
          return acc;
        },
        {},
      ),
    };

    this.setCache(cacheKey, metrics, this.SUMMARY_TTL);
    return metrics;
  }

  async getVolumeTimeSeries(from?: string, to?: string): Promise<VolumeTimeSeries> {
    const cacheKey = `analytics_volume_ts_${from}_${to}`;
    const cached = this.getFromCache<VolumeTimeSeries>(cacheKey);
    if (cached) return cached;

    const [daily30, daily90, monthly12] = await Promise.all([
      this.queryVolumeSeries('%Y-%m-%d', this.daysAgo(30), from, to),
      this.queryVolumeSeries('%Y-%m-%d', this.daysAgo(90), from, to),
      this.queryVolumeSeries('%Y-%m', this.daysAgo(365), from, to),
    ]);

    const result: VolumeTimeSeries = {
      daily30d: this.toChartData(daily30),
      daily90d: this.toChartData(daily90),
      monthly12m: this.toChartData(monthly12),
    };

    this.setCache(cacheKey, result, this.TIMESERIES_TTL);
    return result;
  }

  async getUserTimeSeries(): Promise<UserTimeSeries> {
    const cacheKey = 'analytics_user_ts';
    const cached = this.getFromCache<UserTimeSeries>(cacheKey);
    if (cached) return cached;

    const weeks = await this.userRepository
      .createQueryBuilder('user')
      .select("strftime('%Y-%W', user.updatedAt)", 'week')
      .addSelect('COUNT(DISTINCT user.id)', 'count')
      .where('user.updatedAt > :since', { since: this.daysAgo(84) })
      .groupBy('week')
      .orderBy('week', 'ASC')
      .getRawMany<{ week: string; count: string }>();

    const result: UserTimeSeries = {
      weeklyActive12w: {
        labels: weeks.map((w) => w.week),
        values: weeks.map((w) => parseInt(w.count)),
      },
    };

    this.setCache(cacheKey, result, this.TIMESERIES_TTL);
    return result;
  }

  async getVolumeStats(
    period: 'daily' | 'weekly' | 'monthly',
    from?: string,
    to?: string,
  ): Promise<VolumeStat[]> {
    const cacheKey = `analytics_volume_${period}_${from}_${to}`;
    const cached = this.getFromCache<VolumeStat[]>(cacheKey);
    if (cached) return cached;

    const formatMap: Record<string, string> = {
      daily: '%Y-%m-%d',
      weekly: '%Y-%W',
      monthly: '%Y-%m',
    };
    const dateFormat = formatMap[period] ?? '%Y-%m-%d';

    const query = this.escrowRepository
      .createQueryBuilder('escrow')
      .select(`strftime('${dateFormat}', escrow.createdAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(escrow.amount)', 'volume')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');

    if (from && to) {
      query.where('escrow.createdAt BETWEEN :from AND :to', { from, to });
    }

    const results = await query.getRawMany<{
      bucket: string;
      count: string;
      volume: string | null;
    }>();

    const stats = results.map((r) => ({
      period: r.bucket,
      count: parseInt(r.count),
      volume: parseFloat(r.volume || '0'),
    }));

    this.setCache(cacheKey, stats, this.TIMESERIES_TTL);
    return stats;
  }

  async getTopUsers(limit: number = 10): Promise<TopUser[]> {
    const cacheKey = `analytics_top_users_${limit}`;
    const cached = this.getFromCache<TopUser[]>(cacheKey);
    if (cached) return cached;

    const topUsers = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('escrow_parties', 'party', 'party.userId = user.id')
      .leftJoin('escrows', 'escrow', 'escrow.id = party.escrowId')
      .select('user.walletAddress', 'walletAddress')
      .addSelect('COUNT(DISTINCT escrow.id)', 'escrowCount')
      .addSelect('SUM(escrow.amount)', 'totalVolume')
      .addSelect(
        'SUM(CASE WHEN escrow.status = :completed THEN 1 ELSE 0 END) * 1.0 / NULLIF(COUNT(escrow.id), 0)',
        'completionRate',
      )
      .setParameter('completed', EscrowStatus.COMPLETED)
      .groupBy('user.id')
      .orderBy('totalVolume', 'DESC')
      .limit(limit)
      .getRawMany<{
        walletAddress: string;
        escrowCount: string;
        totalVolume: string | null;
        completionRate: string | null;
      }>();

    const stats = topUsers.map((u) => ({
      walletAddress: u.walletAddress,
      escrowCount: parseInt(u.escrowCount),
      totalVolume: parseFloat(u.totalVolume || '0'),
      completionRate: parseFloat(parseFloat(u.completionRate || '0').toFixed(4)),
    }));

    this.setCache(cacheKey, stats, this.SUMMARY_TTL);
    return stats;
  }

  // Keep legacy method for backwards compat
  async getOverview() {
    return this.getSummary();
  }

  private async queryVolumeSeries(
    fmt: string,
    since: Date,
    from?: string,
    to?: string,
  ) {
    const query = this.escrowRepository
      .createQueryBuilder('escrow')
      .select(`strftime('${fmt}', escrow.createdAt)`, 'bucket')
      .addSelect('SUM(escrow.amount)', 'volume')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC');

    if (from && to) {
      query.where('escrow.createdAt BETWEEN :from AND :to', { from, to });
    } else {
      query.where('escrow.createdAt >= :since', { since: since.toISOString() });
    }

    return query.getRawMany<{ bucket: string; volume: string | null }>();
  }

  private toChartData(rows: { bucket: string; volume: string | null }[]): ChartData {
    return {
      labels: rows.map((r) => r.bucket),
      values: rows.map((r) => parseFloat(r.volume || '0')),
    };
  }
}
