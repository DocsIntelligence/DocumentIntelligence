import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { scrubLogObject } from '../common/redact';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:HH:MM:ss',
                  },
                }
              : undefined,
          // Drop credential headers + common secret body fields entirely.
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.token',
            'req.body.otp',
          ],
          // Mask PII (email/phone/Aadhaar/PAN) that leaks into URLs/queries/messages.
          formatters: {
            log: (obj: Record<string, unknown>) => scrubLogObject(obj),
          },
          customProps: () => ({ context: 'HTTP' }),
        },
      }),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class AppLoggerModule {}
