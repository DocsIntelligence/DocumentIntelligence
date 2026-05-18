import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthResponse,
  ChangePasswordDto,
  ForgotPasswordDto,
  RegisterDto,
  ResetPasswordDto,
  User,
} from '@org/dto';
import { ErrorMessage } from '@org/utils';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { WalletService } from '../payment/wallet.service';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './strategies/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly wallet: WalletService,
  ) {}

  async register(payload: RegisterDto): Promise<AuthResponse> {
    const user = await this.users.create(payload);
    this.logger.log(`Registered new user ${user.email}`);
    const verificationToken = randomUUID();
    await this.users.setVerificationToken(user.id, verificationToken);
    await this.mail.sendVerificationEmail(user.email, verificationToken);
    return this.issueTokens(user);
  }

  async validateUser(
    identifier: string,
    password: string,
  ): Promise<User | null> {
    const entity = await this.users.findByIdentifier(identifier);
    if (!entity?.password) return null;
    const ok = await bcrypt.compare(password, entity.password);
    if (!ok) return null;
    return entity.toPublic();
  }

  async login(user: User): Promise<AuthResponse> {
    return this.issueTokens(user);
  }

  async refresh(user: User): Promise<AuthResponse> {
    return this.issueTokens(user);
  }

  async logout(): Promise<{ message: string }> {
    return { message: 'OK' };
  }

  async forgotPassword({ email }: ForgotPasswordDto) {
    const entity = await this.users.findByEmailOrUsername(email);
    if (!entity) return { message: 'OK' };
    const token = randomUUID();
    await this.users.setResetToken(entity.id, token);
    await this.mail.sendPasswordResetEmail(entity.email, token);
    return { message: 'OK' };
  }

  async resetPassword({ token, password }: ResetPasswordDto) {
    const entity = await this.users.findByResetToken(token);
    if (!entity) throw new BadRequestException(ErrorMessage.InvalidResetToken);
    await this.users.setPassword(entity.id, password);
    return { message: 'OK' };
  }

  async changePassword(userId: string, payload: ChangePasswordDto) {
    const entity = await this.users.findByIdWithSecrets(userId);
    if (!entity) throw new NotFoundException(ErrorMessage.UserNotFound);
    const currentPassword = entity.secrets?.password;
    if (
      !currentPassword ||
      !(await bcrypt.compare(payload.currentPassword, currentPassword))
    ) {
      throw new UnauthorizedException(ErrorMessage.InvalidCredentials);
    }
    await this.users.setPassword(userId, payload.newPassword);
    return { message: 'OK' };
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    // Ensure every authenticating user has a wallet on the free plan.
    // Idempotent; existing paid wallets are untouched. Best-effort:
    // implementation logs and swallows errors so this never blocks signin.
    await this.wallet.ensureFreeWallet(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessTtl = this.config.get<string>(
      'ACCESS_TOKEN_TTL',
      '15m',
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const refreshTtl = this.config.get<string>(
      'REFRESH_TOKEN_TTL',
      '7d',
    ) as `${number}${'s' | 'm' | 'h' | 'd'}`;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
        expiresIn: accessTtl,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: refreshTtl,
      }),
    ]);
    return { user, accessToken, refreshToken };
  }
}
