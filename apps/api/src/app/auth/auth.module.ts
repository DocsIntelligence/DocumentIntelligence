import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { PaymentModule } from '../payment/payment.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasskeyService } from './passkey.service';
import { UserIdentityController } from './user-identity.controller';
import { UserIdentityService } from './user-identity.service';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LinkedInAuthGuard } from './guards/linkedin-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshJwtGuard } from './guards/refresh-jwt.guard';
import { RolesGuard } from './guards/roles.guard';
import { GitHubStrategy } from './strategies/github';
import { GoogleStrategy } from './strategies/google';
import { JwtStrategy } from './strategies/jwt';
import { LinkedInStrategy } from './strategies/linkedin';
import { LocalStrategy } from './strategies/local';
import { RefreshJwtStrategy } from './strategies/refresh-jwt';
import { UsersService } from '../users/users.service';

const logger = new Logger('AuthModule');

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    UsersModule,
    MailModule,
    PaymentModule,
  ],
  controllers: [AuthController, UserIdentityController],
  providers: [
    AuthService,
    PasskeyService,
    UserIdentityService,
    JwtStrategy,
    RefreshJwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    LocalAuthGuard,
    RefreshJwtGuard,
    GoogleAuthGuard,
    GitHubAuthGuard,
    LinkedInAuthGuard,
    RolesGuard,

    // Global JWT guard — every route is protected by default.
    // Use @Public() on a handler/controller to opt out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // OAuth strategies — only registered if env vars are configured
    {
      provide: GoogleStrategy,
      inject: [UsersService, UserIdentityService, ConfigService],
      useFactory: (
        users: UsersService,
        identities: UserIdentityService,
        config: ConfigService,
      ) => {
        if (
          config.get('GOOGLE_CLIENT_ID') &&
          config.get('GOOGLE_CLIENT_SECRET')
        ) {
          return new GoogleStrategy(users, identities, config);
        }
        logger.warn(
          'Google OAuth not configured — GOOGLE_CLIENT_ID/SECRET missing',
        );
        return null;
      },
    },
    {
      provide: GitHubStrategy,
      inject: [UsersService, UserIdentityService, ConfigService],
      useFactory: (
        users: UsersService,
        identities: UserIdentityService,
        config: ConfigService,
      ) => {
        if (
          config.get('GITHUB_CLIENT_ID') &&
          config.get('GITHUB_CLIENT_SECRET')
        ) {
          return new GitHubStrategy(users, identities, config);
        }
        logger.warn(
          'GitHub OAuth not configured — GITHUB_CLIENT_ID/SECRET missing',
        );
        return null;
      },
    },
    {
      provide: LinkedInStrategy,
      inject: [UsersService, UserIdentityService, ConfigService],
      useFactory: (
        users: UsersService,
        identities: UserIdentityService,
        config: ConfigService,
      ) => {
        if (
          config.get('LINKEDIN_CLIENT_ID') &&
          config.get('LINKEDIN_CLIENT_SECRET')
        ) {
          return new LinkedInStrategy(users, identities, config);
        }
        logger.warn(
          'LinkedIn OAuth not configured — LINKEDIN_CLIENT_ID/SECRET missing',
        );
        return null;
      },
    },
  ],
  exports: [AuthService, JwtAuthGuard, RolesGuard, UserIdentityService],
})
export class AuthModule {}
