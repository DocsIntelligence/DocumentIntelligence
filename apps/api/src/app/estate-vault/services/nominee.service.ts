import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateNomineeDto,
  SetNominationsDto,
  UpdateNomineeDto,
} from '@org/dto';
import type { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../mail/mail.service';
import { VaultService } from '../../vault/vault.service';
import { EstateEnvelopeService } from './estate-envelope.service';
import type { ResolvedProfile } from './estate-profile.service';
import { ReleaseService } from './release.service';

type NomineeRow = Prisma.NomineeGetPayload<Record<string, never>>;

/**
 * Nominees + per-asset nominations (docs/13 §1.2/§9). A nominee gets a
 * ReleaseGrant (the dead-man-switch) on creation. Nominee ≠ legal heir.
 *
 * KYC (DOB / Aadhaar / PAN / phone / address / documents) is NOT stored on the
 * Nominee — it lives in a linked Vault PERSON entity, the single source of
 * truth. Every nominee is backed by one: either an existing entity the user
 * picks, or one created from the nominee form. This dedupes the Vault and the
 * estate nominee, and reuses the Vault's encryption, masking, and documents.
 */
@Injectable()
export class NomineeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly vault: VaultService,
    private readonly mail: MailService,
    private readonly release: ReleaseService,
    private readonly envelope: EstateEnvelopeService,
  ) {}

  async list(profile: ResolvedProfile) {
    const rows = await this.db.nominee.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(rows.map((r) => this.present(profile, r)));
  }

  async create(profile: ResolvedProfile, dto: CreateNomineeDto) {
    // Resolve the backing Vault person: link the chosen one, or mint one from
    // the form so every nominee has a profile (the source of truth for KYC).
    const vaultEntityId = await this.resolveVaultEntity(profile, dto);

    const nominee = await this.db.nominee.create({
      data: {
        ownerUserId: profile.ownerUserId,
        profileId: profile.id,
        name: dto.name,
        email: dto.email,
        relationship: dto.relationship ?? null,
        vaultEntityId,
        status: 'invited',
      },
    });
    await this.release.ensureGrant(profile, nominee.id);
    // Best-effort invite (don't fail the request if mail is down).
    void this.mail
      .enqueue({
        to: dto.email,
        subject: 'You have been named in a Wealth Vault',
        html: `<p>${dto.name}, you have been designated as a nominee. You'll be able to access the relevant records if and when access is released. No action is needed now.</p>`,
      })
      .catch(() => undefined);
    return this.present(profile, nominee);
  }

  async update(profile: ResolvedProfile, id: string, dto: UpdateNomineeDto) {
    const nominee = await this.requireInProfile(profile.id, id);
    const owner = profile.ownerUserId;

    // Re-link to a different Vault person if asked.
    let vaultEntityId = nominee.vaultEntityId;
    if (dto.vaultEntityId !== undefined && dto.vaultEntityId !== null) {
      await this.vault.get(owner, dto.vaultEntityId); // ownership check (404s otherwise)
      vaultEntityId = dto.vaultEntityId;
    }

    // KYC edits flow into the linked Vault person (merge over current fields).
    const kycTouched =
      dto.dob !== undefined ||
      dto.phone !== undefined ||
      dto.aadhaar !== undefined ||
      dto.pan !== undefined ||
      dto.address !== undefined ||
      (dto.name !== undefined && !!vaultEntityId);
    if (kycTouched && vaultEntityId) {
      const current = await this.vault.reveal(owner, vaultEntityId);
      const fields = { ...(current.fields as Record<string, string>) };
      applyKyc(fields, { ...dto, name: dto.name ?? nominee.name });
      await this.vault.update(owner, vaultEntityId, { fields });
    }

    const updated = await this.db.nominee.update({
      where: { id: nominee.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.relationship !== undefined
          ? { relationship: dto.relationship }
          : {}),
        ...(vaultEntityId !== nominee.vaultEntityId ? { vaultEntityId } : {}),
      },
    });
    return this.present(profile, updated);
  }

  /** Unmasked KYC — delegated to the linked Vault person (audited there). */
  async reveal(profile: ResolvedProfile, id: string) {
    const nominee = await this.requireInProfile(profile.id, id);
    if (!nominee.vaultEntityId) {
      return { id: nominee.id, phone: null, aadhaar: null, pan: null, address: null };
    }
    const v = await this.vault.reveal(profile.ownerUserId, nominee.vaultEntityId);
    const f = (v.fields ?? {}) as Record<string, string>;
    return {
      id: nominee.id,
      vaultEntityId: nominee.vaultEntityId,
      phone: f['phone'] ?? null,
      aadhaar: f['aadhaar_number'] ?? null,
      pan: f['pan'] ?? null,
      address: [f['address_line1'], f['address_line2'], f['city'], f['state'], f['pincode']]
        .filter(Boolean)
        .join(', ') || null,
    };
  }

  async remove(profile: ResolvedProfile, id: string) {
    await this.requireInProfile(profile.id, id);
    // Capture the assets this nominee could read BEFORE the cascade removes the
    // nominations, so we can rotate their DEKs (kills the removed nominee's key).
    const affected = await this.db.assetNomination.findMany({
      where: { nomineeId: id },
      select: { assetId: true },
    });
    await this.db.nominee.delete({ where: { id } }); // cascades nominations + grant
    for (const { assetId } of affected) {
      await this.envelope.syncNominations(assetId, profile.ownerUserId);
    }
    // The linked Vault person is intentionally left intact (it may be shared
    // and holds documents the user still wants).
    return { ok: true };
  }

  // ── Per-asset nominations ─────────────────────────────────────────────────

  async listNominations(profile: ResolvedProfile, assetId: string) {
    await this.requireAssetInProfile(profile.id, assetId);
    const rows = await this.db.assetNomination.findMany({
      where: { assetId },
      orderBy: { priority: 'asc' },
      include: { nominee: true },
    });
    return rows.map((r) => ({
      nomineeId: r.nomineeId,
      name: r.nominee.name,
      priority: r.priority,
      sharePercent: r.sharePercent,
    }));
  }

  /** Replace the nominee set for an asset (in priority order). */
  async setNominations(
    profile: ResolvedProfile,
    assetId: string,
    dto: SetNominationsDto,
  ) {
    await this.requireAssetInProfile(profile.id, assetId);
    // Verify every nominee belongs to this profile.
    for (const n of dto.nominations) {
      await this.requireInProfile(profile.id, n.nomineeId);
    }
    await this.db.$transaction(async (tx) => {
      await tx.assetNomination.deleteMany({ where: { assetId } });
      for (const n of dto.nominations) {
        await tx.assetNomination.create({
          data: {
            assetId,
            nomineeId: n.nomineeId,
            priority: n.priority,
            sharePercent: n.sharePercent ?? null,
          },
        });
      }
    });
    // Re-key the asset so the new nominee set has wrapped DEKs (and any removed
    // nominee's key is rotated out). Safe no-op when the asset has no secret.
    await this.envelope.syncNominations(assetId, profile.ownerUserId);
    return this.listNominations(profile, assetId);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Link the supplied Vault person, else create one from the nominee form.
   *  Vault ops use the PROFILE owner so the entity stays with the subject. */
  private async resolveVaultEntity(
    profile: ResolvedProfile,
    dto: CreateNomineeDto,
  ): Promise<string> {
    const owner = profile.ownerUserId;
    if (dto.vaultEntityId) {
      await this.vault.get(owner, dto.vaultEntityId); // ownership check
      return dto.vaultEntityId;
    }
    const fields: Record<string, string> = {};
    applyKyc(fields, dto);
    const created = await this.vault.create(owner, {
      kind: 'person',
      label: dto.name,
      fields,
    });
    return created.id;
  }

  private async requireInProfile(
    profileId: string,
    id: string,
  ): Promise<NomineeRow> {
    const nominee = await this.db.nominee.findFirst({
      where: { id, profileId },
    });
    if (!nominee) throw new NotFoundException('Nominee not found');
    return nominee;
  }

  private async requireAssetInProfile(profileId: string, assetId: string) {
    const asset = await this.db.asset.findFirst({
      where: { id: assetId, profileId },
      select: { id: true },
    });
    if (!asset) throw new ForbiddenException('Asset not found');
  }

  /** Hydrate display fields (label + MASKED KYC) from the linked Vault person. */
  private async present(profile: ResolvedProfile, n: NomineeRow) {
    let dob: string | null = null;
    let aadhaarMasked: string | null = null;
    let panMasked: string | null = null;
    if (n.vaultEntityId) {
      try {
        const v = await this.vault.get(profile.ownerUserId, n.vaultEntityId);
        const f = (v.fields ?? {}) as Record<string, string>;
        dob = f['dob'] ?? null;
        aadhaarMasked = f['aadhaar_number'] ?? null; // already masked by vault.get
        panMasked = f['pan'] ?? null;
      } catch {
        // Linked entity missing/inaccessible — present without KYC.
      }
    }
    return {
      id: n.id,
      name: n.name,
      email: n.email,
      relationship: n.relationship,
      dob,
      aadhaarMasked,
      panMasked,
      vaultEntityId: n.vaultEntityId,
      status: n.status,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

/** Map nominee-form KYC onto canonical Vault person field keys (only non-empty;
 *  `undefined` leaves a field untouched, `''`/null clears it). */
function applyKyc(
  fields: Record<string, string>,
  dto: {
    name?: string;
    dob?: string | null;
    phone?: string | null;
    aadhaar?: string | null;
    pan?: string | null;
    address?: string | null;
  },
): void {
  const set = (key: string, v: string | null | undefined) => {
    if (v === undefined) return;
    if (v) fields[key] = v;
    else delete fields[key];
  };
  if (dto.name) fields['full_name'] = dto.name;
  set('dob', dto.dob);
  set('phone', dto.phone);
  set('aadhaar_number', dto.aadhaar);
  set('pan', dto.pan ? dto.pan.toUpperCase() : dto.pan);
  set('address_line1', dto.address);
}
