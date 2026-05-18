import { Module } from '@nestjs/common';
import { PaymentModule } from '../payment/payment.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ExportsModule } from './exports/exports.module';

@Module({
  imports: [PaymentModule, StorageModule, ExportsModule.forRootAsync()],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
