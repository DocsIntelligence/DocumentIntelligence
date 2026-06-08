import { BadRequestException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  private async assertNotLastAdmin(userId: string) {
    const target = await this.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (target?.role !== Role.admin) return;
    const adminCount = await this.db.user.count({
      where: { role: Role.admin },
    });
    if (adminCount <= 1) {
      throw new BadRequestException(
        'Cannot remove the last admin from the system',
      );
    }
  }

  async getUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.db.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          provider: true,
          emailVerified: true,
          createdAt: true,
        },
      }),
      this.db.user.count(),
    ]);
    return { users, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, role: Role) {
    if (role !== Role.admin) await this.assertNotLastAdmin(userId);
    return this.db.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async deleteUser(userId: string) {
    await this.assertNotLastAdmin(userId);
    await this.db.user.delete({ where: { id: userId } });
    return { message: 'User deleted' };
  }

  async getPlans() {
    return this.db.plan.findMany({
      include: { features: true },
      orderBy: { price: 'asc' },
    });
  }

  async getStats() {
    const [userCount, paymentCount, activeWallets] = await Promise.all([
      this.db.user.count(),
      this.db.payment.count({ where: { status: 'completed' } }),
      this.db.userWallet.count({ where: { active: true } }),
    ]);
    return { userCount, paymentCount, activeWallets };
  }

  async getLookups() {
    return this.db.lookupGroup.findMany({
      include: { values: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }
}
