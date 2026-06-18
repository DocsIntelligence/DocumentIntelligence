import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { VaultCryptoService } from '../../vault/vault-crypto.service';

/**
 * App-managed envelope encryption for estate assets (docs/13 §1.1, M4).
 *
 * Each asset's sensitive blob (`Asset.dataEncrypted`) is encrypted with a random
 * per-asset DEK. The DEK is wrapped once per principal allowed to read it —
 * the owner and each nominated nominee — and stored as `DataKey` rows. KEKs are
 * derived from the master key via HKDF (per principal), so:
 *   - release exposes only a nominee's wrapped DEKs (their nominated assets);
 *   - removing a nominee ROTATES the DEK and rebuilds the rows, so their old
 *     wrapped key is dead (not merely deleted);
 *   - swapping to a hosted KMS later changes only KEK wrap/unwrap — no schema
 *     change, since the wrapped-DEK rows are already the unit of access.
 *
 * Scheme discriminator: an asset has the NEW scheme iff it has an `owner`
 * DataKey row. A `dataEncrypted` blob with no DataKey rows is a LEGACY
 * single-master-key blob — migrated on read/sync and by the boot backfill.
 */
@Injectable()
export class EstateEnvelopeService implements OnModuleInit {
  private readonly logger = new Logger(EstateEnvelopeService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: VaultCryptoService,
  ) {}

  /** One-time, idempotent migration of legacy master-key blobs on boot. */
  async onModuleInit(): Promise<void> {
    try {
      await this.backfill();
    } catch (e) {
      this.logger.warn(`Estate envelope backfill skipped: ${String(e)}`);
    }
  }

  private ownerRef(userId: string): string {
    return `owner:${userId}`;
  }
  private nomineeRef(nomineeId: string): string {
    return `nominee:${nomineeId}`;
  }

  /**
   * Seal an asset's sensitive blob: fresh DEK, encrypt → `dataEncrypted`, and
   * rebuild the wrapped-DEK rows for the owner + every current nominee. Empty
   * blob ⇒ clear `dataEncrypted` and drop all DataKey rows. Always rotates the
   * DEK, which is what makes nominee removal safe.
   */
  async write(
    assetId: string,
    ownerUserId: string,
    blob: Record<string, string>,
  ): Promise<string | null> {
    const entries = Object.entries(blob).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) {
      await this.db.$transaction([
        this.db.dataKey.deleteMany({ where: { assetId } }),
        this.db.asset.update({
          where: { id: assetId },
          data: { dataEncrypted: null },
        }),
      ]);
      return null;
    }

    const dek = this.crypto.randomKey();
    const dataEncrypted = this.crypto.encryptWith(
      dek,
      JSON.stringify(Object.fromEntries(entries)),
    );
    const nomineeIds = (
      await this.db.assetNomination.findMany({
        where: { assetId },
        select: { nomineeId: true },
      })
    ).map((n) => n.nomineeId);

    const rows = [
      {
        assetId,
        principalType: 'owner',
        principalId: ownerUserId,
        wrappedDek: this.crypto.wrapKey(dek, this.crypto.deriveKek(this.ownerRef(ownerUserId))),
      },
      ...nomineeIds.map((nomineeId) => ({
        assetId,
        principalType: 'nominee',
        principalId: nomineeId,
        wrappedDek: this.crypto.wrapKey(
          dek,
          this.crypto.deriveKek(this.nomineeRef(nomineeId)),
        ),
      })),
    ];

    await this.db.$transaction([
      this.db.dataKey.deleteMany({ where: { assetId } }),
      this.db.dataKey.createMany({ data: rows }),
      this.db.asset.update({
        where: { id: assetId },
        data: { dataEncrypted },
      }),
    ]);
    return dataEncrypted;
  }

  /** Decrypt the owner's view of an asset's blob ({} when none). Lazily
   *  upgrades a legacy master-key blob to the envelope scheme on first read. */
  async revealOwner(
    assetId: string,
    ownerUserId: string,
    dataEncrypted: string | null,
  ): Promise<Record<string, unknown>> {
    if (!dataEncrypted) return {};
    const dk = await this.db.dataKey.findUnique({
      where: {
        assetId_principalType_principalId: {
          assetId,
          principalType: 'owner',
          principalId: ownerUserId,
        },
      },
    });
    if (dk) {
      const dek = this.crypto.unwrapKey(
        dk.wrappedDek,
        this.crypto.deriveKek(this.ownerRef(ownerUserId)),
      );
      return JSON.parse(this.crypto.decryptWith(dek, dataEncrypted));
    }
    // Legacy: decrypt with the master key, then upgrade in place.
    const plaintext = this.crypto.decryptFields(dataEncrypted);
    try {
      await this.write(assetId, ownerUserId, plaintext as Record<string, string>);
    } catch (e) {
      this.logger.warn(`Lazy envelope upgrade failed for ${assetId}: ${String(e)}`);
    }
    return plaintext;
  }

  /** Decrypt a nominee's scoped view of an asset's blob (release path, §1.2).
   *  Falls back to the master key for not-yet-migrated legacy assets (the
   *  server can read either way; access is scoped by the caller's query). */
  async revealNominee(
    assetId: string,
    nomineeId: string,
    ownerUserId: string,
    dataEncrypted: string | null,
  ): Promise<Record<string, unknown>> {
    if (!dataEncrypted) return {};
    const dk = await this.db.dataKey.findUnique({
      where: {
        assetId_principalType_principalId: {
          assetId,
          principalType: 'nominee',
          principalId: nomineeId,
        },
      },
    });
    if (dk) {
      const dek = this.crypto.unwrapKey(
        dk.wrappedDek,
        this.crypto.deriveKek(this.nomineeRef(nomineeId)),
      );
      return JSON.parse(this.crypto.decryptWith(dek, dataEncrypted));
    }
    // No nominee key — migrate via the owner path (also wraps for the nominee),
    // then retry; falls back to master-key decrypt if the asset is legacy.
    await this.revealOwner(assetId, ownerUserId, dataEncrypted).catch(() => ({}));
    const retry = await this.db.dataKey.findUnique({
      where: {
        assetId_principalType_principalId: {
          assetId,
          principalType: 'nominee',
          principalId: nomineeId,
        },
      },
    });
    if (retry) {
      const dek = this.crypto.unwrapKey(
        retry.wrappedDek,
        this.crypto.deriveKek(this.nomineeRef(nomineeId)),
      );
      return JSON.parse(this.crypto.decryptWith(dek, dataEncrypted));
    }
    return this.crypto.decryptFields(dataEncrypted);
  }

  /** Re-key an asset from its current plaintext + current nominations. Call
   *  after any nomination change or nominee removal (rotates the DEK). */
  async syncNominations(assetId: string, ownerUserId: string): Promise<void> {
    const asset = await this.db.asset.findUnique({
      where: { id: assetId },
      select: { dataEncrypted: true },
    });
    if (!asset?.dataEncrypted) return;
    const plaintext = await this.revealOwner(
      assetId,
      ownerUserId,
      asset.dataEncrypted,
    );
    await this.write(assetId, ownerUserId, plaintext as Record<string, string>);
  }

  /** Migrate every legacy asset (has `dataEncrypted`, lacks an owner DataKey). */
  async backfill(): Promise<number> {
    const legacy = await this.db.asset.findMany({
      where: {
        dataEncrypted: { not: null },
        dataKeys: { none: { principalType: 'owner' } },
      },
      select: { id: true, ownerUserId: true, dataEncrypted: true },
      take: 1000,
    });
    let migrated = 0;
    for (const a of legacy) {
      if (!a.ownerUserId) continue;
      try {
        const plaintext = this.crypto.decryptFields(a.dataEncrypted);
        await this.write(a.id, a.ownerUserId, plaintext as Record<string, string>);
        migrated += 1;
      } catch (e) {
        this.logger.warn(`Envelope backfill failed for asset ${a.id}: ${String(e)}`);
      }
    }
    if (migrated > 0) {
      this.logger.log(`Estate envelope: migrated ${migrated} legacy asset(s).`);
    }
    return migrated;
  }
}
