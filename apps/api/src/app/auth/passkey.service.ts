import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class PasskeyService {
  private readonly logger = new Logger(PasskeyService.name);
  private readonly rpName: string;
  private readonly rpId: string;
  private readonly origin: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    // The RP ID must be the domain the browser's top-level page runs on (or a
    // registrable parent of it) — passkeys are registered/verified from
    // wherever the user is signed in (apps/app), not from the API host. Using
    // PUBLIC_URL (the API's own origin) here would silently break passkeys
    // the moment API and app live on different subdomains in production
    // (api.doclio.in vs app.doclio.in) — dev only "worked" because both
    // default to localhost. WEBAUTHN_RP_ID overrides the derived hostname,
    // e.g. to the apex domain so credentials work across every subdomain.
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5200',
    );
    const url = new URL(frontendUrl);
    this.rpId = this.config.get<string>('WEBAUTHN_RP_ID') ?? url.hostname;
    this.rpName = this.config.get<string>('WEBAUTHN_RP_NAME') ?? '@org';
    this.origin = this.config.get<string>('WEBAUTHN_ORIGIN') ?? url.origin;
  }

  // ─── Challenge helpers ────────────────────────────────────────

  private async storeChallenge(key: string, challenge: string) {
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
    await this.db.challenge.upsert({
      where: { key },
      update: { value: challenge, expiresAt },
      create: { key, value: challenge, expiresAt },
    });
  }

  private async consumeChallenge(key: string): Promise<string> {
    const record = await this.db.challenge.findUnique({ where: { key } });
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Challenge expired or not found. Please try again.',
      );
    }
    await this.db.challenge.delete({ where: { key } });
    return record.value;
  }

  // ─── Registration ─────────────────────────────────────────────

  async generateRegistrationOptions(userId: string) {
    const user = await this.users.findById(userId);
    const existingPasskeys = await this.db.passkey.findMany({
      where: { userId },
      select: { credentialId: true, transports: true },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
      excludeCredentials: existingPasskeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports as AuthenticatorTransportFuture[],
      })),
    });

    await this.storeChallenge(`reg:${userId}`, options.challenge);
    return options;
  }

  async verifyRegistrationAndSave(
    userId: string,
    credential: RegistrationResponseJSON,
    label?: string,
  ) {
    const expectedChallenge = await this.consumeChallenge(`reg:${userId}`);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException(
        'Passkey registration verification failed.',
      );
    }

    const {
      credential: cred,
      credentialDeviceType,
      credentialBackedUp,
    } = verification.registrationInfo;

    await this.db.passkey.create({
      data: {
        credentialId: cred.id,
        publicKey: Buffer.from(cred.publicKey),
        counter: BigInt(cred.counter),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: cred.transports ?? [],
        label: label || null,
        userId,
      },
    });

    this.logger.log(`Passkey registered for user=${userId}`);
    return { verified: true };
  }

  // ─── Authentication ───────────────────────────────────────────

  async generateAuthenticationOptions(email?: string) {
    let allowCredentials:
      | { id: string; transports?: AuthenticatorTransportFuture[] }[]
      | undefined;
    let challengeKey: string;

    if (email) {
      const user = await this.db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (user) {
        const passkeys = await this.db.passkey.findMany({
          where: { userId: user.id },
          select: { credentialId: true, transports: true },
        });
        allowCredentials = passkeys.map((pk) => ({
          id: pk.credentialId,
          transports: pk.transports as AuthenticatorTransportFuture[],
        }));
      }
      challengeKey = `auth:${email}`;
    } else {
      challengeKey = `auth:${randomBytes(16).toString('hex')}`;
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      allowCredentials,
    });

    await this.storeChallenge(challengeKey, options.challenge);
    return { ...options, _challengeKey: challengeKey };
  }

  async verifyAuthenticationAndLogin(
    credential: AuthenticationResponseJSON,
    challengeKey: string,
  ) {
    const expectedChallenge = await this.consumeChallenge(challengeKey);

    const passkey = await this.db.passkey.findUnique({
      where: { credentialId: credential.id },
      include: { user: true },
    });

    if (!passkey) {
      throw new BadRequestException('Passkey not recognized.');
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new BadRequestException('Passkey authentication failed.');
    }

    // Update counter
    await this.db.passkey.update({
      where: { id: passkey.id },
      data: { counter: BigInt(verification.authenticationInfo.newCounter) },
    });

    return this.users.findById(passkey.userId);
  }

  // ─── Management ───────────────────────────────────────────────

  async listForUser(userId: string) {
    return this.db.passkey.findMany({
      where: { userId },
      select: { id: true, label: true, deviceType: true, createdAt: true },
    });
  }

  async deleteForUser(userId: string, passkeyId: string) {
    const passkey = await this.db.passkey.findFirst({
      where: { id: passkeyId, userId },
    });
    if (!passkey) throw new BadRequestException('Passkey not found');
    await this.db.passkey.delete({ where: { id: passkeyId } });
    return { message: 'Passkey removed' };
  }
}
