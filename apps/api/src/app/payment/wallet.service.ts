import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PlanService } from './plan.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly planService: PlanService,
  ) {}

  async getWallet(userId: string) {
    return this.db.userWallet.findUnique({
      where: { userId },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            type: true,
            currency: true,
          },
        },
        usage: true,
      },
    });
  }

  async getUserWallet(userId: string) {
    const wallet = await this.getWallet(userId);
    if (!wallet) return null;

    // Check expiry
    if (wallet.endAt < new Date()) {
      await this.activateFreeWallet(userId);
      return this.getWallet(userId);
    }
    return wallet;
  }

  async activateFreeWallet(userId: string) {
    const freePlanId = await this.planService.getFreePlanId();
    await this.createWallet(userId, freePlanId);
  }

  /**
   * Idempotent: if the user already has a wallet, leave it alone (never
   * downgrade a paid user). Otherwise provision the free plan. Called on
   * every signin so users created before pricing existed get a wallet on
   * their next login.
   *
   * Best-effort: any error is logged and swallowed so a transient DB
   * issue doesn't block signin.
   */
  async ensureFreeWallet(userId: string): Promise<void> {
    try {
      const existing = await this.db.userWallet.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (existing) return;
      await this.activateFreeWallet(userId);
      this.logger.debug(`Provisioned free wallet for user ${userId}`);
    } catch (err) {
      this.logger.warn(
        `ensureFreeWallet failed for ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async createWallet(userId: string, planId: string, paymentId?: string) {
    const plan = await this.db.plan.findUnique({
      where: { id: planId },
      include: { features: true },
    });
    if (!plan) throw new BadRequestException('Plan not found');

    const { startDate, endDate } = this.calculateDates(
      plan.duration,
      plan.interval,
    );

    const existing = await this.db.userWallet.findUnique({ where: { userId } });

    if (existing) {
      // Update existing wallet
      await this.db.userWallet.update({
        where: { id: existing.id },
        data: {
          paymentType: plan.type,
          startAt: startDate,
          endAt: endDate,
          active: true,
          paymentId,
          planId,
        },
      });

      // Upsert usage for each feature
      for (const feature of plan.features) {
        await this.db.walletUsage.upsert({
          where: {
            name_userWalletId: {
              name: feature.name,
              userWalletId: existing.id,
            },
          },
          update: {
            quantity:
              feature.action === 'reset'
                ? feature.quantity
                : { increment: feature.quantity },
            ...(feature.action === 'reset' ? { consumed: 0 } : {}),
          },
          create: {
            name: feature.name,
            quantity: feature.quantity,
            userWalletId: existing.id,
          },
        });
      }
    } else {
      // Create new wallet
      await this.db.userWallet.create({
        data: {
          paymentType: plan.type,
          startAt: startDate,
          endAt: endDate,
          active: true,
          paymentId,
          planId,
          userId,
          usage: {
            createMany: {
              data: plan.features.map((f) => ({
                name: f.name,
                quantity: f.quantity,
              })),
            },
          },
        },
      });
    }
  }

  private calculateDates(duration: number, interval: string) {
    const startDate = new Date();
    const endDate = new Date(startDate);

    switch (interval) {
      case 'daily':
        endDate.setDate(startDate.getDate() + duration);
        break;
      case 'weekly':
        endDate.setDate(startDate.getDate() + duration * 7);
        break;
      case 'monthly':
        endDate.setMonth(startDate.getMonth() + duration);
        break;
      case 'quarterly':
        endDate.setMonth(startDate.getMonth() + duration * 3);
        break;
      case 'yearly':
        endDate.setFullYear(startDate.getFullYear() + duration);
        break;
      default:
        endDate.setMonth(startDate.getMonth() + duration);
    }

    return { startDate, endDate };
  }
}
