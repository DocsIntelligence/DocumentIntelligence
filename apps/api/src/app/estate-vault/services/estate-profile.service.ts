import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { VaultService } from '../../vault/vault.service';

type ProfileRow = Prisma.EstateProfileGetPayload<Record<string, never>>;

export interface ResolvedProfile {
  id: string;
  ownerUserId: string;
  vaultEntityId: string;
  label: string;
  isSelf: boolean;
  /** Privacy default: mask monetary amounts on screen until revealed. */
  maskAmounts: boolean;
  /** Acting user's role on this profile: 'owner' | 'manager' | 'viewer'. */
  role: 'owner' | 'manager' | 'viewer';
}

/**
 * Manages the per-person vaults (docs/13): each EstateProfile is one managed
 * person (self, spouse, a client of a wealth manager…), backed by a Vault PERSON
 * entity. A single account can own several, and a profile can be shared with
 * other accounts (a 3rd-party manager, or the original person). All estate data
 * is scoped by `profileId`; this service is the single place that resolves +
 * authorises which profile the acting user may touch.
 */
@Injectable()
export class EstateProfileService {
  constructor(
    private readonly db: DatabaseService,
    private readonly vault: VaultService,
  ) {}

  /** The acting user's own profile — created (with a Vault person) on first use,
   *  then any pre-multi-profile rows are migrated onto it. */
  async ensureSelf(userId: string): Promise<ProfileRow> {
    const existing = await this.db.estateProfile.findFirst({
      where: { ownerUserId: userId, isSelf: true },
    });
    if (existing) return existing;

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const label = user?.name?.trim() || 'Myself';
    const entity = await this.vault.create(userId, {
      kind: 'person',
      label,
      fields: user?.name ? { full_name: user.name } : {},
    });
    try {
      const profile = await this.db.estateProfile.create({
        data: { ownerUserId: userId, vaultEntityId: entity.id, label, isSelf: true },
      });
      await this.backfill(userId, profile.id);
      return profile;
    } catch (e) {
      // Lost a race with a concurrent ensureSelf: the partial unique index
      // (ownerUserId WHERE isSelf) rejected this second insert. Use the winner
      // and discard the now-orphaned Vault person we just minted.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await this.db.estateProfile.findFirst({
          where: { ownerUserId: userId, isSelf: true },
        });
        if (winner) {
          await this.vault.remove(userId, entity.id).catch(() => undefined);
          return winner;
        }
      }
      throw e;
    }
  }

  /** Assign this user's legacy (profileId = null) rows to their self profile. */
  private async backfill(userId: string, profileId: string): Promise<void> {
    const where = { ownerUserId: userId, profileId: null } as const;
    await this.db.$transaction([
      this.db.asset.updateMany({ where, data: { profileId } }),
      this.db.nominee.updateMany({ where, data: { profileId } }),
      this.db.wealthSnapshot.updateMany({ where, data: { profileId } }),
      this.db.releaseGrant.updateMany({ where, data: { profileId } }),
    ]);
  }

  /** Resolve a profile for the acting user (authorised). No id ⇒ their self. */
  async resolve(userId: string, profileId?: string | null): Promise<ResolvedProfile> {
    if (!profileId) return this.present(await this.ensureSelf(userId), userId);
    const profile = await this.db.estateProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    const role = await this.roleFor(userId, profile);
    if (!role) throw new ForbiddenException('No access to this profile');
    return this.present(profile, userId, role);
  }

  /** Profiles the user can act on — owned + shared-with. */
  async list(userId: string): Promise<ResolvedProfile[]> {
    await this.ensureSelf(userId);
    const owned = await this.db.estateProfile.findMany({
      where: { ownerUserId: userId },
      orderBy: [{ isSelf: 'desc' }, { createdAt: 'asc' }],
    });
    const sharedAccess = await this.db.estateProfileAccess.findMany({
      where: { userId },
      include: { profile: true },
    });
    const shared = sharedAccess.map((a) =>
      this.present(a.profile, userId, a.role === 'viewer' ? 'viewer' : 'manager'),
    );
    return [...owned.map((p) => this.present(p, userId, 'owner')), ...shared];
  }

  /** Create a new managed profile — link an existing Vault person or mint one. */
  async create(
    userId: string,
    dto: {
      label?: string;
      vaultEntityId?: string;
      name?: string;
      dob?: string;
      aadhaar?: string;
      pan?: string;
      phone?: string;
      address?: string;
    },
  ): Promise<ResolvedProfile> {
    let vaultEntityId = dto.vaultEntityId;
    let label = dto.label;
    if (vaultEntityId) {
      const ent = await this.vault.get(userId, vaultEntityId); // ownership check
      label = label || ent.label;
    } else {
      const fields: Record<string, string> = {};
      if (dto.name) fields['full_name'] = dto.name;
      if (dto.dob) fields['dob'] = dto.dob;
      if (dto.aadhaar) fields['aadhaar_number'] = dto.aadhaar;
      if (dto.pan) fields['pan'] = dto.pan.toUpperCase();
      if (dto.phone) fields['phone'] = dto.phone;
      if (dto.address) fields['address_line1'] = dto.address;
      const ent = await this.vault.create(userId, {
        kind: 'person',
        label: dto.name || dto.label || 'New person',
        fields,
      });
      vaultEntityId = ent.id;
      label = label || dto.name || ent.label;
    }
    const profile = await this.db.estateProfile.create({
      data: {
        ownerUserId: userId,
        vaultEntityId,
        label: label || 'New person',
        isSelf: false,
      },
    });
    return this.present(profile, userId, 'owner');
  }

  async remove(userId: string, profileId: string): Promise<{ ok: boolean }> {
    const profile = await this.requireOwned(userId, profileId);
    if (profile.isSelf) {
      throw new ForbiddenException('Your own profile cannot be deleted.');
    }
    const assetCount = await this.db.asset.count({
      where: { profileId, isActive: true },
    });
    if (assetCount > 0) {
      throw new ForbiddenException(
        'Remove or move this profile’s assets before deleting it.',
      );
    }
    await this.db.estateProfile.delete({ where: { id: profileId } });
    return { ok: true };
  }

  // ── Sharing (3rd-party wealth manager / the original person) ───────────────

  async listAccess(userId: string, profileId: string) {
    await this.requireOwned(userId, profileId);
    const rows = await this.db.estateProfileAccess.findMany({
      where: { profileId },
    });
    const users = await this.db.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, email: true, name: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      email: byId.get(r.userId)?.email ?? null,
      name: byId.get(r.userId)?.name ?? null,
      role: r.role,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async share(
    userId: string,
    profileId: string,
    email: string,
    role: 'manager' | 'viewer',
  ) {
    await this.requireOwned(userId, profileId);
    const target = await this.db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('No account with that email.');
    }
    if (target.id === userId) {
      throw new ForbiddenException('You already own this profile.');
    }
    await this.db.estateProfileAccess.upsert({
      where: { profileId_userId: { profileId, userId: target.id } },
      create: { profileId, userId: target.id, role },
      update: { role },
    });
    return { ok: true };
  }

  async unshare(userId: string, profileId: string, targetUserId: string) {
    await this.requireOwned(userId, profileId);
    await this.db.estateProfileAccess
      .delete({ where: { profileId_userId: { profileId, userId: targetUserId } } })
      .catch(() => undefined);
    return { ok: true };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async roleFor(
    userId: string,
    profile: ProfileRow,
  ): Promise<'owner' | 'manager' | 'viewer' | null> {
    if (profile.ownerUserId === userId) return 'owner';
    const access = await this.db.estateProfileAccess.findUnique({
      where: { profileId_userId: { profileId: profile.id, userId } },
    });
    if (!access) return null;
    return access.role === 'viewer' ? 'viewer' : 'manager';
  }

  private async requireOwned(
    userId: string,
    profileId: string,
  ): Promise<ProfileRow> {
    const profile = await this.db.estateProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile || profile.ownerUserId !== userId) {
      throw new ForbiddenException('Only the profile owner can do that.');
    }
    return profile;
  }

  private present(
    p: ProfileRow,
    _userId: string,
    role: 'owner' | 'manager' | 'viewer' = 'owner',
  ): ResolvedProfile {
    return {
      id: p.id,
      ownerUserId: p.ownerUserId,
      vaultEntityId: p.vaultEntityId,
      label: p.label,
      isSelf: p.isSelf,
      maskAmounts: p.maskAmounts,
      role,
    };
  }

  /** Update profile settings (label / amount-masking). Owner or manager only. */
  async update(
    userId: string,
    profileId: string,
    patch: { label?: string; maskAmounts?: boolean },
  ): Promise<ResolvedProfile> {
    const profile = await this.db.estateProfile.findUnique({
      where: { id: profileId },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    const role = await this.roleFor(userId, profile);
    if (role !== 'owner' && role !== 'manager') {
      throw new ForbiddenException('No access to edit this profile');
    }
    const updated = await this.db.estateProfile.update({
      where: { id: profileId },
      data: {
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.maskAmounts !== undefined
          ? { maskAmounts: patch.maskAmounts }
          : {}),
      },
    });
    return this.present(updated, userId, role);
  }
}
