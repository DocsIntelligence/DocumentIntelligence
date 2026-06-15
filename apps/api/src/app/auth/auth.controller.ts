import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@org/dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthResponse, MessageResponse, User } from '@org/dto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password';
import { ForgotPasswordDto } from './dto/forgot-password';
import { LoginDto } from './dto/login';
import { RegisterDto } from './dto/register';
import { ResetPasswordDto } from './dto/reset-password';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshJwtGuard } from './guards/refresh-jwt.guard';
import { GitHubAuthGuard } from './guards/github-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { LinkedInAuthGuard } from './guards/linkedin-auth.guard';
import { PasskeyService } from './passkey.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly cookieDomain: string;
  private readonly cookieSecure: boolean;
  private readonly accessTtlMs: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly passkeyService: PasskeyService,
  ) {
    this.cookieDomain = this.config.get<string>('COOKIE_DOMAIN', 'localhost');
    this.cookieSecure =
      this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
    this.accessTtlMs = this.parseTtlToMs(
      this.config.get<string>('ACCESS_TOKEN_TTL', '15m'),
    );
    this.refreshTtlMs = this.parseTtlToMs(
      this.config.get<string>('REFRESH_TOKEN_TTL', '7d'),
    );
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'Get available auth providers' })
  @ApiResponse({ status: 200, description: 'List of enabled auth providers' })
  getProviders() {
    const providers: string[] = ['email'];

    if (
      this.config.get('GOOGLE_CLIENT_ID') &&
      this.config.get('GOOGLE_CLIENT_SECRET')
    ) {
      providers.push('google');
    }
    if (
      this.config.get('GITHUB_CLIENT_ID') &&
      this.config.get('GITHUB_CLIENT_SECRET')
    ) {
      providers.push('github');
    }
    if (
      this.config.get('LINKEDIN_CLIENT_ID') &&
      this.config.get('LINKEDIN_CLIENT_SECRET')
    ) {
      providers.push('linkedin');
    }

    return { providers };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User created, tokens set as cookies',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or user already exists',
  })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login with email/username and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Authenticated, tokens set as cookies',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Req() _req: Request,
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(loginSchema)) _body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Public()
  @UseGuards(RefreshJwtGuard)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token (via cookie or body)' })
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.authService.refresh(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and clear auth cookies' })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 201, description: 'Logged out, cookies cleared' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<MessageResponse> {
    this.clearAuthCookies(res);
    return this.authService.logout();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  me(@CurrentUser() user: User): User {
    return user;
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset email' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 201,
    description: 'Reset email sent (if account exists)',
  })
  forgot(
    @Body(new ZodValidationPipe(forgotPasswordSchema))
    body: ForgotPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 201, description: 'Password updated' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  reset(
    @Body(new ZodValidationPipe(resetPasswordSchema))
    body: ResetPasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.resetPassword({
      token: body.token,
      password: body.password,
    });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change-password')
  @ApiOperation({ summary: 'Change password (requires current password)' })
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 201, description: 'Password changed' })
  @ApiResponse({ status: 401, description: 'Current password incorrect' })
  change(
    @CurrentUser() user: User,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordDto,
  ): Promise<MessageResponse> {
    return this.authService.changePassword(user.id, {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
  }

  // ─── OAuth: GitHub ────────────────────────────────────────────

  @Public()
  @Get('github')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({
    summary: 'Initiate GitHub OAuth',
    description:
      'Redirects to GitHub for authorization. After user approves, GitHub redirects back to /auth/github/callback.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to GitHub OAuth consent screen',
  })
  githubLogin() {
    return;
  }

  @Public()
  @Get('github/callback')
  @UseGuards(GitHubAuthGuard)
  @ApiOperation({
    summary: 'GitHub OAuth callback',
    description:
      'Called by GitHub after authorization. Sets auth cookies and redirects to PUBLIC_URL/auth/callback?status=authenticated&method=github',
  })
  @ApiResponse({
    status: 302,
    description: 'Sets cookies, redirects to frontend callback page',
  })
  @ApiResponse({ status: 401, description: 'GitHub authorization failed' })
  async githubCallback(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    const redirectUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5200',
    );
    res.redirect(
      `${redirectUrl}/auth/callback?status=authenticated&method=github`,
    );
  }

  // ─── OAuth: Google ────────────────────────────────────────────

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Initiate Google OAuth',
    description:
      'Redirects to Google for authorization. After user approves, Google redirects back to /auth/google/callback.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to Google OAuth consent screen',
  })
  googleLogin() {
    return;
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Called by Google after authorization. Sets auth cookies and redirects to PUBLIC_URL/auth/callback?status=authenticated&method=google',
  })
  @ApiResponse({
    status: 302,
    description: 'Sets cookies, redirects to frontend callback page',
  })
  @ApiResponse({ status: 401, description: 'Google authorization failed' })
  async googleCallback(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    const redirectUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5200',
    );
    res.redirect(
      `${redirectUrl}/auth/callback?status=authenticated&method=google`,
    );
  }

  // ─── OAuth: LinkedIn ──────────────────────────────────────────

  @Public()
  @Get('linkedin')
  @UseGuards(LinkedInAuthGuard)
  @ApiOperation({
    summary: 'Initiate LinkedIn OAuth',
    description:
      'Redirects to LinkedIn for authorization. After user approves, LinkedIn redirects back to /auth/linkedin/callback.',
  })
  @ApiResponse({
    status: 302,
    description: 'Redirects to LinkedIn OAuth consent screen',
  })
  linkedinLogin() {
    return;
  }

  @Public()
  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  @ApiOperation({
    summary: 'LinkedIn OAuth callback',
    description:
      'Called by LinkedIn after authorization. Sets auth cookies and redirects to PUBLIC_URL/auth/callback?status=authenticated&method=linkedin',
  })
  @ApiResponse({
    status: 302,
    description: 'Sets cookies, redirects to frontend callback page',
  })
  @ApiResponse({ status: 401, description: 'LinkedIn authorization failed' })
  async linkedinCallback(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    const redirectUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5200',
    );
    res.redirect(
      `${redirectUrl}/auth/callback?status=authenticated&method=linkedin`,
    );
  }

  // ─── Passkeys ─────────────────────────────────────────────────

  @Post('passkey/register/options')
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Get passkey registration options' })
  passkeyRegisterOptions(@CurrentUser() user: User) {
    return this.passkeyService.generateRegistrationOptions(user.id);
  }

  @Post('passkey/register/verify')
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Verify passkey registration' })
  passkeyRegisterVerify(
    @CurrentUser() user: User,
    @Body() body: { credential: unknown; label?: string },
  ) {
    return this.passkeyService.verifyRegistrationAndSave(
      user.id,
      body.credential as never,
      body.label,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('passkey/login/options')
  @ApiOperation({ summary: 'Get passkey login options' })
  passkeyLoginOptions(@Body() body: { email?: string }) {
    return this.passkeyService.generateAuthenticationOptions(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('passkey/login/verify')
  @ApiOperation({ summary: 'Verify passkey login' })
  async passkeyLoginVerify(
    @Body() body: { credential: unknown; challengeKey: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const user = await this.passkeyService.verifyAuthenticationAndLogin(
      body.credential as never,
      body.challengeKey,
    );
    const result = await this.authService.login(user);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return result;
  }

  @Get('passkeys')
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'List user passkeys' })
  listPasskeys(@CurrentUser() user: User) {
    return this.passkeyService.listForUser(user.id);
  }

  @Delete('passkey/:id')
  @ApiBearerAuth('bearer')
  @ApiCookieAuth('access_token')
  @ApiOperation({ summary: 'Delete a passkey' })
  deletePasskey(@CurrentUser() user: User, @Param('id') id: string) {
    return this.passkeyService.deleteForUser(user.id, id);
  }

  // ─── Cookie helpers ───────────────────────────────────────────────────

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const shared = {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax' as const,
      domain: this.cookieDomain,
      path: '/',
    };

    res.cookie('access_token', accessToken, {
      ...shared,
      maxAge: this.accessTtlMs,
    });

    res.cookie('refresh_token', refreshToken, {
      ...shared,
      maxAge: this.refreshTtlMs,
      path: '/api/auth/refresh',
    });
  }

  private clearAuthCookies(res: Response) {
    const shared = {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax' as const,
      domain: this.cookieDomain,
    };

    res.clearCookie('access_token', { ...shared, path: '/' });
    res.clearCookie('refresh_token', { ...shared, path: '/api/auth/refresh' });
  }

  private parseTtlToMs(ttl: string): number {
    const match = ttl.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
