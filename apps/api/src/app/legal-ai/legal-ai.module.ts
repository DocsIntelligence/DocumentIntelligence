import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PaymentModule } from '../payment/payment.module';
import { LegalAiController } from './legal-ai.controller';
import { LegalAiService } from './legal-ai.service';

@Module({
  imports: [AiModule, PaymentModule],
  controllers: [LegalAiController],
  providers: [LegalAiService],
  exports: [LegalAiService],
})
export class LegalAiModule {}
