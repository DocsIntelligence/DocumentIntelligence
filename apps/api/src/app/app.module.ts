import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { CommonModule } from './common/common.module';
import { RequestLoggerMiddleware } from './common/middleware/logger.middleware';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { IntelligenceAdminModule } from './intelligence-admin/intelligence-admin.module';
import { LegalAiModule } from './legal-ai/legal-ai.module';
import { SharesModule } from './shares/shares.module';
import { SignersModule } from './signers/signers.module';
import { AppLoggerModule } from './logger/logger.module';
import { LookupModule } from './lookup/lookup.module';
import { MailModule } from './mail/mail.module';
import { PaymentModule } from './payment/payment.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    MailModule.forRootAsync(),
    CommonModule,
    AuthModule,
    UsersModule,
    HealthModule,
    PaymentModule,
    AdminModule,
    LookupModule,
    AiModule,
    StorageModule,
    DocumentsModule,
    LegalAiModule,
    IntelligenceModule.forRootAsync(),
    IntelligenceAdminModule,
    SharesModule,
    CommentsModule,
    SignersModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
