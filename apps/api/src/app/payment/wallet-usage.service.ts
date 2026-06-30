import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Feature } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class WalletUsageService {
  private readonly logger = new Logger(WalletUsageService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  /** Master switch — when false, all quota checks pass (no metering gate). */
  private get billingEnforced(): boolean {
    return this.config.get<string>('BILLING_ENFORCED') !== 'false';
  }

  async trackUsage(userId: string, feature: Feature, quantity = 1) {
    const wallet = await this.db.userWallet.findUnique({ where: { userId } });
    if (!wallet) return;

    try {
      await this.db.walletUsage.update({
        where: {
          name_userWalletId: { name: feature, userWalletId: wallet.id },
        },
        data: { consumed: { increment: quantity } },
      });
    } catch (error) {
      this.logger.error(`Failed to track usage for ${feature}`, error);
    }
  }

  async checkQuota(userId: string, feature: Feature): Promise<boolean> {
    if (!this.billingEnforced) return true; // BILLING_ENFORCED=false → pass all

    const wallet = await this.db.userWallet.findUnique({
      where: { userId },
      include: { usage: true },
    });
    if (!wallet) return false;

    const usage = wallet.usage.find((u) => u.name === feature);
    if (!usage) return false;
    if (usage.quantity === -1) return true; // unlimited
    return usage.consumed < usage.quantity;
  }
}
