import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { PlanService } from './plan.service';
import { WalletService } from './wallet.service';
import type { VerifyPaymentDto } from './payment.dto';

interface RazorpayClient {
  orders: {
    create(opts: Record<string, unknown>): Promise<{
      id: string;
      amount: number;
      currency: string;
    }>;
  };
  subscriptions: {
    create(
      opts: Record<string, unknown>,
    ): Promise<{ id: string } & Record<string, unknown>>;
  };
  payments: {
    fetch(id: string): Promise<{
      id: string;
      order_id?: string;
      amount: number;
      currency: string;
      created_at: number;
      notes?: Record<string, string | undefined>;
    }>;
  };
}

type RazorpayCtor = new (opts: {
  key_id: string;
  key_secret: string;
}) => RazorpayClient;

const safeEqualHex = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
};

@Injectable()
export class RazorpayService implements OnModuleInit {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: RazorpayClient | null = null;
  private readonly webhookSecret: string;
  private readonly keySecret: string;
  private readonly keyId: string;
  private enabled = false;

  constructor(
    private readonly db: DatabaseService,
    private readonly planService: PlanService,
    private readonly walletService: WalletService,
    private readonly config: ConfigService,
  ) {
    this.keyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET', '');
  }

  async onModuleInit(): Promise<void> {
    if (!this.keyId || !this.keySecret) {
      this.logger.warn(
        'Razorpay not configured — RAZORPAY_KEY_ID/SECRET missing',
      );
      return;
    }

    try {
      const mod = (await import('razorpay')) as unknown as
        | { default?: RazorpayCtor }
        | RazorpayCtor;
      const Razorpay = (typeof mod === 'function' ? mod : mod.default) as
        | RazorpayCtor
        | undefined;
      if (!Razorpay) {
        throw new Error('razorpay export not callable');
      }
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
      this.enabled = true;
      this.logger.log('Razorpay initialized');
    } catch (err) {
      this.logger.warn(
        `Razorpay package failed to load — payment disabled (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
    }
  }

  isEnabled() {
    return this.enabled;
  }

  private client(): RazorpayClient {
    if (!this.enabled || !this.razorpay) {
      throw new BadRequestException('Payment gateway not configured');
    }
    return this.razorpay;
  }

  async createOrder(userId: string, planId: string) {
    const client = this.client();
    const plan = await this.planService.getPlanById(planId);
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (plan.type === 'subscription' && plan.gatewayPlanId) {
      const subscription = await client.subscriptions.create({
        plan_id: plan.gatewayPlanId,
        quantity: 1,
        total_count: plan.totalCycleCount ?? 12,
        notes: { appUserId: userId, appPlanId: planId },
      });
      return {
        type: 'subscription',
        subscriptionId: subscription.id,
        ...subscription,
      };
    }

    const order = await client.orders.create({
      amount: plan.price * plan.priceMultiplier,
      currency: plan.currency,
      payment_capture: true,
      notes: { appUserId: userId, appUserEmail: user.email, appPlanId: planId },
    });

    return {
      type: 'order',
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  }

  async verifyPayment(currentUserId: string, body: VerifyPaymentDto) {
    const client = this.client();
    // Verify signature
    const signatureBody = body.razorpay_order_id
      ? `${body.razorpay_order_id}|${body.razorpay_payment_id}`
      : `${body.razorpay_payment_id}|${body.razorpay_subscription_id}`;

    const expected = createHmac('sha256', this.keySecret)
      .update(signatureBody)
      .digest('hex');
    if (!safeEqualHex(expected, body.razorpay_signature)) {
      throw new BadRequestException('Payment signature verification failed');
    }

    // Fetch payment details
    const paymentDetails = await client.payments.fetch(
      body.razorpay_payment_id,
    );
    const { appPlanId, appUserId } = (paymentDetails.notes ?? {}) as {
      appPlanId?: string;
      appUserId?: string;
    };

    if (!appPlanId || !appUserId)
      throw new BadRequestException('Payment notes missing');

    // Bind to caller — prevents activating someone else's wallet using their payment id
    if (appUserId !== currentUserId) {
      throw new ForbiddenException(
        'Payment does not belong to the current user',
      );
    }

    // Idempotency: rely on the unique constraint on gatewayPaymentId.
    try {
      const payment = await this.db.payment.create({
        data: {
          gateway: 'razorpay',
          gatewayPaymentId: paymentDetails.id,
          gatewayOrderId: paymentDetails.order_id ?? '',
          gatewaySubscriptionId: body.razorpay_subscription_id ?? '',
          status: 'completed',
          amount: paymentDetails.amount,
          currency: paymentDetails.currency as never,
          initiatedAt: new Date(paymentDetails.created_at * 1000),
          confirmedAt: new Date(),
          userId: appUserId,
        },
      });
      await this.walletService.createWallet(appUserId, appPlanId, payment.id);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Already processed by webhook (or a concurrent verify) — treat as success.
        return { verified: true };
      }
      throw err;
    }
    return { verified: true };
  }

  async handleWebhook(signature: string, rawBody: Buffer, body: unknown) {
    if (!this.enabled) return;
    if (!this.webhookSecret) {
      throw new BadRequestException(
        'Webhook secret not configured (RAZORPAY_WEBHOOK_SECRET)',
      );
    }

    const hash = createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
    if (!safeEqualHex(hash, signature))
      throw new BadRequestException('Invalid webhook signature');

    const event = body as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            created_at?: number;
            notes?: { appPlanId?: string; appUserId?: string };
          };
        };
      };
    };

    if (event.event !== 'payment.captured') return;

    const payment = event.payload?.payment?.entity;
    const appPlanId = payment?.notes?.appPlanId;
    const appUserId = payment?.notes?.appUserId;
    if (!payment?.id || !appPlanId || !appUserId) return;

    try {
      const record = await this.db.payment.create({
        data: {
          gateway: 'razorpay',
          gatewayPaymentId: payment.id,
          gatewayOrderId: payment.order_id ?? '',
          status: 'completed',
          amount: payment.amount,
          currency: payment.currency as never,
          initiatedAt: payment.created_at
            ? new Date(payment.created_at * 1000)
            : new Date(),
          confirmedAt: new Date(),
          userId: appUserId,
        },
      });
      await this.walletService.createWallet(appUserId, appPlanId, record.id);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Already processed by /verify (or a concurrent webhook delivery).
        return;
      }
      throw err;
    }
  }
}
