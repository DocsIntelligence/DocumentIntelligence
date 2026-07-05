import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { MailTransport } from './mail.transport';
import type { SendMailDto } from './dto/send-mail.dto';

const MAIL_QUEUE_ENABLED = 'MAIL_QUEUE_ENABLED';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Optional() @InjectQueue('mail') private readonly mailQueue: Queue | null,
    @Inject(MAIL_QUEUE_ENABLED) private readonly queueEnabled: boolean,
    private readonly db: DatabaseService,
    private readonly transport: MailTransport,
  ) {}

  /** Enqueue a mail for async delivery, or send synchronously if Redis is unavailable */
  async enqueue(dto: SendMailDto): Promise<string> {
    // Persist to DB first
    const log = await this.db.mailLog.create({
      data: {
        to: dto.to,
        subject: dto.subject,
        template: dto.template,
        body: dto.html ?? dto.text,
        status: 'queued',
        metadata: dto.templateData as any,
      },
    });

    if (this.queueEnabled && this.mailQueue) {
      // Add to queue for async processing
      await this.mailQueue.add(
        'send',
        { ...dto, logId: log.id },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.debug(
        `Queued mail to ${dto.to}: ${dto.subject} (id: ${log.id})`,
      );
    } else {
      // Send synchronously — no Redis available
      try {
        await this.transport.send(dto.to, dto.subject, dto.html ?? '');
        await this.db.mailLog.update({
          where: { id: log.id },
          data: { status: 'sent', sentAt: new Date(), attempts: 1 },
        });
        this.logger.debug(
          `Sent mail synchronously to ${dto.to}: ${dto.subject} (id: ${log.id})`,
        );
      } catch (error) {
        const message = (error as Error).message;
        this.logger.error(`Failed to send mail to ${dto.to}: ${message}`);
        await this.db.mailLog.update({
          where: { id: log.id },
          data: { status: 'failed', error: message, attempts: 1 },
        });
      }
    }

    return log.id;
  }

  /** Convenience: send verification email */
  async sendVerificationEmail(email: string, token: string): Promise<string> {
    const publicUrl = process.env['PUBLIC_URL'] ?? 'http://localhost:5230';
    return this.enqueue({
      to: email,
      subject: 'Verify your email',
      template: 'verification',
      templateData: {
        name: email.split('@')[0],
        verifyLink: `${publicUrl}/verify-email?token=${token}`,
      },
    });
  }

  /** Convenience: send password reset email */
  async sendPasswordResetEmail(email: string, token: string): Promise<string> {
    const publicUrl = process.env['PUBLIC_URL'] ?? 'http://localhost:5230';
    return this.enqueue({
      to: email,
      subject: 'Reset your password',
      template: 'password-reset',
      templateData: {
        name: email.split('@')[0],
        resetLink: `${publicUrl}/reset-password?token=${token}`,
      },
    });
  }

  /** Convenience: send welcome email */
  async sendWelcomeEmail(email: string, name: string): Promise<string> {
    return this.enqueue({
      to: email,
      subject: 'Welcome!',
      template: 'welcome',
      templateData: { name },
    });
  }
}
