import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { EstateEnvelopeService } from './estate-envelope.service';
import type { ResolvedProfile } from './estate-profile.service';
import { EstateVaultConfigService } from './estate-vault-config.service';
import { claimInstructionFor } from '../estate.constants';

type AssetWithNominations = Prisma.AssetGetPayload<{
  include: { nominations: { include: { nominee: true } } };
}>;

interface ReportAsset {
  id: string;
  type: string;
  typeLabel: string;
  label: string;
  institution: string | null;
  currency: string;
  value: number;
  identifier: string | null;
  identifierMasked: string | null;
  maturityDate: string | null;
  nominees: { name: string; priority: number }[];
  howToClaim: string;
}

/**
 * The Estate Report / Asset Register (docs/13 §10.3) — the artifact passed down
 * so "money is not orphaned". Two forms: the owner's masked preview ("what my
 * family will see") and the released nominee's read-only view (identifiers
 * decrypted, scoped to that nominee), unlocked by an access token.
 */
@Injectable()
export class EstateReportService {
  constructor(
    private readonly db: DatabaseService,
    private readonly envelope: EstateEnvelopeService,
    private readonly config: EstateVaultConfigService,
  ) {}

  /** Owner-facing preview — identifiers stay MASKED. */
  async ownerReport(profile: ResolvedProfile) {
    const assets = await this.db.asset.findMany({
      where: { profileId: profile.id, isActive: true },
      orderBy: { type: 'asc' },
      include: { nominations: { include: { nominee: true }, orderBy: { priority: 'asc' } } },
    });
    return this.assemble(assets, { reveal: false });
  }

  // (nomineeView below passes the grant so the nominee's wrapped DEK is used.)

  /** Released nominee view by token — identifiers DECRYPTED, scoped to the
   *  nominee. 403 until the grant is released. Audited. */
  async nomineeView(token: string) {
    const grant = await this.db.releaseGrant.findUnique({
      where: { accessToken: token },
      include: { nominee: true },
    });
    if (!grant) throw new NotFoundException('Invalid access link');
    if (grant.status !== 'released') {
      throw new ForbiddenException('Access has not been released');
    }

    const where: Prisma.AssetWhereInput = {
      // Scope to the grant's profile (the subject person), falling back to the
      // owner for legacy grants created before multi-profile.
      ...(grant.profileId
        ? { profileId: grant.profileId }
        : { ownerUserId: grant.ownerUserId }),
      isActive: true,
      ...(grant.scope === 'nominated'
        ? { nominations: { some: { nomineeId: grant.nomineeId } } }
        : {}),
    };
    const assets = await this.db.asset.findMany({
      where,
      orderBy: { type: 'asc' },
      include: { nominations: { include: { nominee: true }, orderBy: { priority: 'asc' } } },
    });

    await this.db.estateAccessLog.create({
      data: {
        ownerUserId: grant.ownerUserId,
        nomineeId: grant.nomineeId,
        grantId: grant.id,
        action: 'nominee_view',
        detail: `${assets.length} asset(s)`,
      },
    });

    const report = await this.assemble(assets, {
      reveal: true,
      nomineeId: grant.nomineeId,
      ownerUserId: grant.ownerUserId,
    });
    return {
      nominee: { name: grant.nominee.name },
      releasedAt: grant.releasedAt ? grant.releasedAt.toISOString() : null,
      ...report,
    };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async assemble(
    assets: AssetWithNominations[],
    opts: { reveal: boolean; nomineeId?: string; ownerUserId?: string },
  ) {
    const types = await this.config.assetTypes(null);
    const labels = new Map(types.map((t) => [t.key, t.label]));

    const items: ReportAsset[] = await Promise.all(
      assets.map(async (a) => {
      let identifier: string | null = null;
      if (opts.reveal && a.dataEncrypted && opts.nomineeId && opts.ownerUserId) {
        const secret = await this.envelope.revealNominee(
          a.id,
          opts.nomineeId,
          opts.ownerUserId,
          a.dataEncrypted,
        );
        identifier = (secret['identifier'] as string) ?? null;
      }
      return {
        id: a.id,
        type: a.type,
        typeLabel: labels.get(a.type) ?? a.type,
        label: a.label,
        institution: a.institution,
        currency: a.currency,
        value: a.currentValueMinor ? Number(a.currentValueMinor) / 100 : 0,
        identifier,
        identifierMasked: a.identifierMasked,
        maturityDate: a.maturityDate ? a.maturityDate.toISOString() : null,
        nominees: a.nominations.map((n) => ({
          name: n.nominee.name,
          priority: n.priority,
        })),
        howToClaim: claimInstructionFor(a.type),
      };
      }),
    );

    const totalValue = items.reduce((sum, i) => sum + i.value, 0);
    const withoutNominee = items.filter((i) => i.nominees.length === 0).length;

    return {
      generatedAt: new Date().toISOString(),
      currency: 'INR',
      totalValue,
      assetCount: items.length,
      assetsWithoutNominee: withoutNominee,
      assets: items,
    };
  }
}
