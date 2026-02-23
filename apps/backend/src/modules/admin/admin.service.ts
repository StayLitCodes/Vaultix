import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { User, UserRole } from '../user/entities/user.entity';
import { Escrow, EscrowStatus } from '../escrow/entities/escrow.entity';
import { Party } from '../escrow/entities/party.entity';
import { EscrowEvent } from '../escrow/entities/escrow-event.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(EscrowEvent)
    private escrowEventRepository: Repository<EscrowEvent>,
  ) {}

  async getAllUsers(page: number = 1, limit: number = 50) {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'walletAddress',
        'role',
        'isActive',
        'createdAt',
        'updatedAt',
      ],
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAllEscrows(filters: {
    status?: EscrowStatus;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { status, page = 1, limit = 50, startDate, endDate } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = Between(new Date(startDate), new Date(endDate));
    }

    const [escrows, total] = await this.escrowRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['parties'],
    });

    return {
      escrows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPlatformStats() {
    const [
      totalUsers,
      activeUsers,
      totalEscrows,
      activeEscrows,
      completedEscrows,
      totalVolume,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.escrowRepository.count(),
      this.escrowRepository.count({ where: { status: EscrowStatus.ACTIVE } }),
      this.escrowRepository.count({
        where: { status: EscrowStatus.COMPLETED },
      }),
      this.escrowRepository
        .createQueryBuilder('escrow')
        .select('SUM(escrow.amount)', 'total')
        .where('escrow.status = :status', { status: EscrowStatus.COMPLETED })
        .getRawOne(),
    ]);

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      newUsersLast30Days,
      newEscrowsLast30Days,
      completedEscrowsLast30Days,
    ] = await Promise.all([
      this.userRepository.count({
        where: { createdAt: MoreThan(last30Days) },
      }),
      this.escrowRepository.count({
        where: { createdAt: MoreThan(last30Days) },
      }),
      this.escrowRepository.count({
        where: {
          status: EscrowStatus.COMPLETED,
          updatedAt: MoreThan(last30Days),
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        newLast30Days: newUsersLast30Days,
      },
      escrows: {
        total: totalEscrows,
        active: activeEscrows,
        completed: completedEscrows,
        newLast30Days: newEscrowsLast30Days,
        completedLast30Days: completedEscrowsLast30Days,
      },
      volume: {
        totalCompleted: parseFloat(totalVolume?.total || '0'),
      },
      roles: await this.getUserRoleStats(),
    };
  }

  async suspendUser(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new Error('Cannot suspend super admin');
    }

    user.isActive = false;
    await this.userRepository.save(user);

    return { message: 'User suspended successfully', user };
  }

  private async getUserRoleStats() {
    const stats = await this.userRepository
      .createQueryBuilder('user')
      .select('user.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany();

    return stats.reduce((acc, stat) => {
      acc[stat.role] = parseInt(stat.count);
      return acc;
    }, {});
  }
}
