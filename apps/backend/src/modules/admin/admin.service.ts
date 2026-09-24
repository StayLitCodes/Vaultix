import {
  Injectable,
  Inject,
  forwardRef,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import { User, UserRole } from '../user/entities/user.entity';
import { AdminAuditLogService } from './services/admin-audit-log.service';
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
    private readonly adminAuditLogService: AdminAuditLogService,
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

  async suspendUser(userId: string, actorId?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new Error('Cannot suspend super admin');
    }

    const oldStatus = user.isActive;
    user.isActive = false;
    await this.userRepository.save(user);

    // Audit log
    await this.adminAuditLogService.create({
      actorId: actorId || 'system',
      actionType: 'SUSPEND_USER',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: {
        oldStatus,
        newStatus: user.isActive,
        userRole: user.role,
      },
    });

    return { message: 'User suspended successfully', user };
  }

  async promoteUser(
    targetUserId: string,
    actorId: string,
    reason: string,
  ): Promise<{ message: string; user: User }> {
    // Cannot promote self
    if (targetUserId === actorId) {
      throw new ConflictException('Cannot promote your own account');
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      throw new ConflictException(
        `User is already a ${user.role}. No promotion needed.`,
      );
    }

    const oldRole = user.role;
    user.role = UserRole.ADMIN;
    await this.userRepository.save(user);

    await this.adminAuditLogService.create({
      actorId,
      actionType: 'PROMOTE_USER',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: {
        oldRole,
        newRole: UserRole.ADMIN,
        reason,
      },
    });

    return { message: `User promoted to ${UserRole.ADMIN}`, user };
  }

  async demoteUser(
    targetUserId: string,
    actorId: string,
    reason: string,
  ): Promise<{ message: string; user: User }> {
    // Cannot demote self
    if (targetUserId === actorId) {
      throw new ConflictException('Cannot demote your own account');
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If the target is a super-admin, check we won't orphan the last one
    if (user.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await this.userRepository.count({
        where: { role: UserRole.SUPER_ADMIN },
      });
      if (superAdminCount <= 1) {
        throw new ConflictException(
          'Cannot demote the last remaining super-admin. Promote another user to super-admin first.',
        );
      }
    }

    if (user.role === UserRole.USER) {
      throw new ConflictException(
        'User is already a regular user. No demotion needed.',
      );
    }

    const oldRole = user.role;
    user.role = UserRole.USER;
    await this.userRepository.save(user);

    await this.adminAuditLogService.create({
      actorId,
      actionType: 'DEMOTE_USER',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: {
        oldRole,
        newRole: UserRole.USER,
        reason,
      },
    });

    return { message: `User demoted to ${UserRole.USER}`, user };
  }

  async getUserRoleHistory(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roleChanges = await this.adminAuditLogService.findAll({
      resourceType: 'USER',
      resourceId: userId,
      actionType: 'PROMOTE_USER',
    });

    const demotions = await this.adminAuditLogService.findAll({
      resourceType: 'USER',
      resourceId: userId,
      actionType: 'DEMOTE_USER',
    });

    const allChanges = [...roleChanges.data, ...demotions.data].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        currentRole: user.role,
      },
      roleHistory: allChanges,
    };
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
