import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
/** Domain-separation salt for HKDF-derived per-principal KEKs (estate M4). */
const KEK_SALT = 'starter-estate-vault-kek-v1';

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
    return this.encryptWith(this.key, plaintext);
  }

  decrypt(blob: string): string {
    return this.decryptWith(this.key, blob);
  }

  // ── Envelope-encryption primitives (estate M4, docs/13 §1.1) ───────────────
  //
  // The data model is per-asset DEK + per-principal wrapped DataKeys. KEKs are
  // derived from the master key via HKDF here; swapping to a hosted KMS later is
  // an internal change to `deriveKek` (and wrap/unwrap → KMS calls) with NO
  // schema change. Not zero-knowledge — the server can derive any KEK — which is
  // the accepted v1 trade-off (docs/13 §1.1).

  /** AES-256-GCM encrypt with an explicit key → "iv:tag:ciphertext" (base64). */
  encryptWith(key: Buffer, plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  /** Inverse of `encryptWith`. */
  decryptWith(key: Buffer, blob: string): string {
    const [ivB64, tagB64, dataB64] = blob.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed vault ciphertext');
    }
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** A fresh random 256-bit data-encryption key (DEK). */
  randomKey(): Buffer {
    return randomBytes(KEY_BYTES);
  }

  /** Derive a principal's 256-bit KEK from the master key (HKDF-SHA256). */
  deriveKek(principalRef: string): Buffer {
    return Buffer.from(
      hkdfSync('sha256', this.key, KEK_SALT, principalRef, KEY_BYTES),
    );
  }

  /** Wrap (encrypt) a DEK under a principal's KEK → storable string. */
  wrapKey(dek: Buffer, kek: Buffer): string {
    return this.encryptWith(kek, dek.toString('base64'));
  }

  /** Unwrap (decrypt) a wrapped DEK with a principal's KEK. */
  unwrapKey(wrapped: string, kek: Buffer): Buffer {
    return Buffer.from(this.decryptWith(kek, wrapped), 'base64');
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
