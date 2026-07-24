import { Injectable, Logger } from '@nestjs/common';
import { APP_CONFIG } from '@org/utils';
import type { EnterpriseLeadDto } from '@org/dto';
import { MailService } from '../mail/mail.service';
import { enterpriseLeadTemplate } from './enterprise-lead.template';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly mail: MailService) {}

  async submitEnterpriseInquiry(dto: EnterpriseLeadDto): Promise<void> {
    this.logger.log(`Enterprise inquiry from ${dto.email} (${dto.company})`);
    await this.mail.enqueue({
      to: APP_CONFIG.support.email,
      subject: `Enterprise inquiry — ${dto.company}`,
      html: enterpriseLeadTemplate(dto),
    });
  }
}
