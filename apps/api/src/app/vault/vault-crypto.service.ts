import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * AES-256-GCM encryption for vault field data (docs/10). The key comes from
 * `VAULT_ENCRYPTION_KEY` (base64, 32 bytes). In production the key is REQUIRED;
 * in development a deterministic key is derived with a loud warning so the app
 * still boots, but that key must never be used for real data.
 *
 * Ciphertext format: `base64(iv):base64(authTag):base64(ciphertext)`.
 */
@Injectable()
export class VaultCryptoService {
  private readonly logger = new Logger(VaultCryptoService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('VAULT_ENCRYPTION_KEY');
    const isProd = config.get<string>('NODE_ENV') === 'production';
    if (raw) {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length !== 32) {
        throw new Error(
          'VAULT_ENCRYPTION_KEY must be 32 bytes base64 (generate: `openssl rand -base64 32`).',
        );
      }
      this.key = buf;
    } else if (isProd) {
      throw new Error(
        'VAULT_ENCRYPTION_KEY is required in production — the document vault refuses to start without it.',
      );
    } else {
      this.logger.warn(
        'VAULT_ENCRYPTION_KEY not set — using a DERIVED DEV KEY. Do NOT store real PII; set the key for production.',
      );
      this.key = createHash('sha256')
        .update('starter-dev-vault-key-do-not-use-in-prod')
        .digest();
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(blob: string): string {
    const [ivB64, tagB64, dataB64] = blob.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed vault ciphertext');
    }
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Encrypt a fields object → ciphertext blob (or null for empty). */
  encryptFields(fields: Record<string, unknown>): string | null {
    if (!fields || Object.keys(fields).length === 0) return null;
    return this.encrypt(JSON.stringify(fields));
  }

  /** Decrypt a ciphertext blob → fields object ({} when null/blank). */
  decryptFields(blob: string | null): Record<string, unknown> {
    if (!blob) return {};
    try {
      return JSON.parse(this.decrypt(blob)) as Record<string, unknown>;
    } catch (e) {
      this.logger.error(`vault decrypt failed: ${String(e)}`);
      throw new Error('Could not decrypt vault data (key mismatch?)');
    }
  }
}
