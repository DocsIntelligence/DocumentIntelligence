import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { UpdateReleasePlanDto } from '@org/dto';
import type { Prisma } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { MailService } from '../../mail/mail.service';
import { StorageService } from '../../storage/storage.service';
import { EstateVaultConfigService } from './estate-vault-config.service';

/** One stored proof-of-death reference on a ReleaseGrant. */
interface ProofRef {
  s3Key: string;
  filename: string;
  contentType: string;
  note: string | null;
  uploadedAt: string;
}

type GrantRow = Prisma.ReleaseGrantGetPayload<{ include: { nominee: true } }>;

/** Reminder window (days) between liveness pings once a check-in is overdue. */
const PING_WINDOW_DAYS = 7;

/**
 * The dead-man-switch (docs/13 §1.2/§1.3). One ReleaseGrant per (owner,
 * nominee). The owner "checks in" to stay alive; the scheduler advances missed
 * check-ins to `pinged` → `escalated`. v1 NEVER auto-releases — release is
 * human-verified (§11.6) via the admin endpoint. On `released`, a token unlocks
 * a read-only nominee view (see EstateReportService).
 */
@Injectable()
export class ReleaseService {
  private readonly logger = new Logger(ReleaseService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: EstateVaultConfigService,
    private readonly mail: MailService,
    private readonly storage: StorageService,
    private readonly appConfig: ConfigService,
  ) {}

  // ── Proof of death (nominee-initiated, public token) ──────────────────────

  /** Minimal status for the public nominee page — no asset data revealed. */
  async proofStatus(token: string) {
    const grant = await this.db.releaseGrant.findUnique({
      where: { accessToken: token },
      include: { nominee: true },
    });
    if (!grant) throw new NotFoundException('Invalid access link');
    return {
      status: grant.status,
      released: grant.status === 'released',
      nomineeName: grant.nominee.name,
      proofCount: proofList(grant.proofRefs).length,
    };
  }

  /** A nominee uploads a death certificate / proof. Stores it, advances the
   *  grant to `escalated` for human review, and audits. Never auto-releases. */
  async submitProof(
    token: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    note?: string,
  ) {
    const grant = await this.db.releaseGrant.findUnique({
      where: { accessToken: token },
    });
    if (!grant) throw new NotFoundException('Invalid access link');
    if (grant.status === 'revoked') {
      throw new BadRequestException('This access has been revoked.');
    }
    const stored = await this.storage.upload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      folder: 'estate-vault/proofs',
    });
    const proofs = proofList(grant.proofRefs);
    proofs.push({
      s3Key: stored.key,
      filename: file.originalname,
      contentType: file.mimetype,
      note: note?.trim() || null,
      uploadedAt: new Date().toISOString(),
    });
    const advance =
      grant.status === 'active' || grant.status === 'pinged'
        ? 'escalated'
        : grant.status;
    await this.db.releaseGrant.update({
      where: { id: grant.id },
      data: { proofRefs: proofs as unknown as Prisma.InputJsonValue, status: advance },
    });
    await this.log(
      grant.ownerUserId,
      grant.nomineeId,
      grant.id,
      'proof_submitted',
      file.originalname,
    );
    return { ok: true, proofCount: proofs.length };
  }

  /** Admin: presigned URL for a stored proof file (verification step). */
  async proofUrl(grantId: string, index: number) {
    const grant = await this.db.releaseGrant.findUnique({ where: { id: grantId } });
    if (!grant) throw new NotFoundException('Grant not found');
    const proofs = proofList(grant.proofRefs);
    const proof = proofs[index];
    if (!proof) throw new NotFoundException('Proof not found');
    const url = await this.storage.getPresignedDownloadUrl(proof.s3Key);
    return { url, filename: proof.filename, contentType: proof.contentType };
  }

  /** Create the grant for a nominee if absent (idempotent). Profile-scoped. */
  async ensureGrant(
    profile: { id: string; ownerUserId: string },
    nomineeId: string,
  ) {
    const existing = await this.db.releaseGrant.findUnique({
      where: {
        ownerUserId_nomineeId: { ownerUserId: profile.ownerUserId, nomineeId },
      },
    });
    if (existing) return existing;
    const cfg = await this.config.resolve(null);
    const now = new Date();
    return this.db.releaseGrant.create({
      data: {
        ownerUserId: profile.ownerUserId,
        profileId: profile.id,
        nomineeId,
        scope: 'nominated',
        status: 'active',
        cadenceDays: cfg.livenessCadenceDays,
        lastCheckInAt: now,
        nextPingAt: addDays(now, cfg.livenessCadenceDays),
        accessToken: mintToken(),
      },
    });
  }

  async listGrants(profile: { id: string }) {
    const rows = await this.db.releaseGrant.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
      include: { nominee: true },
    });
    return rows.map((r) => this.present(r));
  }

  /** Owner check-in: resets the timer on this profile's non-terminal grants. */
  async checkIn(profile: { id: string; ownerUserId: string }) {
    const now = new Date();
    const grants = await this.db.releaseGrant.findMany({
      where: {
        profileId: profile.id,
        status: { in: ['active', 'pinged', 'escalated'] },
      },
    });
    for (const g of grants) {
      await this.db.releaseGrant.update({
        where: { id: g.id },
        data: {
          status: 'active',
          missedCount: 0,
          lastCheckInAt: now,
          nextPingAt: addDays(now, g.cadenceDays),
        },
      });
    }
    await this.log(profile.ownerUserId, null, null, 'checkin', `${grants.length} grant(s) reset`);
    return { ok: true, reset: grants.length };
  }

  async updatePlan(
    profile: { id: string },
    nomineeId: string,
    dto: UpdateReleasePlanDto,
  ) {
    const grant = await this.requireGrant(profile.id, nomineeId);
    const cadenceDays = dto.cadenceDays ?? grant.cadenceDays;
    const updated = await this.db.releaseGrant.update({
      where: { id: grant.id },
      data: {
        cadenceDays,
        scope: dto.scope ?? grant.scope,
        nextPingAt: addDays(grant.lastCheckInAt, cadenceDays),
      },
      include: { nominee: true },
    });
    return this.present(updated);
  }

  /** Owner revokes a nominee's pending/active grant (while alive). */
  async revoke(profile: { id: string; ownerUserId: string }, nomineeId: string) {
    const grant = await this.requireGrant(profile.id, nomineeId);
    await this.db.releaseGrant.update({
      where: { id: grant.id },
      data: { status: 'revoked' },
    });
    await this.log(profile.ownerUserId, nomineeId, grant.id, 'revoke', null);
    return { ok: true };
  }

  /** Human-verified release (admin/ops). Unlocks the nominee's read-only view. */
  async release(grantId: string) {
    const grant = await this.db.releaseGrant.findUnique({ where: { id: grantId } });
    if (!grant) throw new NotFoundException('Grant not found');
    await this.db.releaseGrant.update({
      where: { id: grantId },
      data: { status: 'released', releasedAt: new Date() },
    });
    await this.log(grant.ownerUserId, grant.nomineeId, grant.id, 'release', null);
    return { ok: true };
  }

  async listAllForAdmin() {
    const rows = await this.db.releaseGrant.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { nominee: true },
    });
    return rows.map((r) => ({
      ...this.present(r),
      ownerUserId: r.ownerUserId,
      proofs: proofList(r.proofRefs).map((p, index) => ({
        index,
        filename: p.filename,
        note: p.note,
        uploadedAt: p.uploadedAt,
      })),
    }));
  }

  // ── Scheduler sweep (called by EstateLivenessService) ─────────────────────

  /** Advance overdue grants: active/pinged past nextPingAt → ping/escalate.
   *  Never auto-releases. Returns the number advanced. */
  async tick(): Promise<number> {
    const now = new Date();
    const due = await this.db.releaseGrant.findMany({
      where: { status: { in: ['active', 'pinged'] }, nextPingAt: { lt: now } },
      include: { nominee: true },
      take: 500,
    });
    if (due.length === 0) return 0;
    const cfg = await this.config.resolve(null);
    for (const g of due) {
      const missedCount = g.missedCount + 1;
      const escalated = missedCount >= cfg.missedPingsBeforeEscalation;
      await this.db.releaseGrant.update({
        where: { id: g.id },
        data: {
          missedCount,
          status: escalated ? 'escalated' : 'pinged',
          nextPingAt: addDays(now, PING_WINDOW_DAYS),
        },
      });
      await this.notifyOwner(g.ownerUserId, escalated);
      // On escalation, invite the nominee to submit proof of death (the link is
      // their access token; it still only reveals assets once released).
      if (escalated) this.notifyNominee(g);
      await this.log(
        g.ownerUserId,
        g.nomineeId,
        g.id,
        escalated ? 'escalate' : 'ping',
        `missed ${missedCount}`,
      );
    }
    this.logger.log(`Estate liveness: advanced ${due.length} grant(s).`);
    return due.length;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async notifyOwner(ownerUserId: string, escalated: boolean) {
    const user = await this.db.user.findUnique({
      where: { id: ownerUserId },
      select: { email: true, name: true },
    });
    if (!user?.email) return;
    void this.mail
      .enqueue({
        to: user.email,
        subject: escalated
          ? 'Action needed: confirm you still manage your Wealth Vault'
          : 'Reminder: check in to your Wealth Vault',
        html: `<p>${user.name ?? 'Hello'}, please open your Wealth Vault and check in to confirm you still manage it. If we don't hear from you, your nominees may be granted access per your settings.</p>`,
      })
      .catch(() => undefined);
  }

  /** Email the nominee a proof-of-death submission link (best-effort). */
  private notifyNominee(grant: GrantRow) {
    const base = (this.appConfig.get<string>('FRONTEND_URL') ?? '').replace(/\/$/, '');
    const link = base ? `${base}/n/${grant.accessToken}` : '';
    void this.mail
      .enqueue({
        to: grant.nominee.email,
        subject: 'Wealth Vault — action may be needed',
        html: `<p>${grant.nominee.name}, the owner who named you as a nominee has missed repeated check-ins.${
          link
            ? ` If appropriate, you can submit proof (e.g. a death certificate) here: <a href="${link}">${link}</a>.`
            : ''
        } Access to their records is only granted after a manual review.</p>`,
      })
      .catch(() => undefined);
  }

  private async requireGrant(
    profileId: string,
    nomineeId: string,
  ): Promise<GrantRow> {
    const grant = await this.db.releaseGrant.findFirst({
      where: { profileId, nomineeId },
      include: { nominee: true },
    });
    if (!grant) throw new NotFoundException('Release grant not found');
    return grant;
  }

  private log(
    ownerUserId: string | null,
    nomineeId: string | null,
    grantId: string | null,
    action: string,
    detail: string | null,
  ) {
    return this.db.estateAccessLog.create({
      data: { ownerUserId, nomineeId, grantId, action, detail },
    });
  }

  private present(g: GrantRow) {
    return {
      id: g.id,
      nominee: { id: g.nominee.id, name: g.nominee.name, email: g.nominee.email },
      scope: g.scope,
      status: g.status,
      cadenceDays: g.cadenceDays,
      lastCheckInAt: g.lastCheckInAt.toISOString(),
      nextPingAt: g.nextPingAt.toISOString(),
      missedCount: g.missedCount,
      releasedAt: g.releasedAt ? g.releasedAt.toISOString() : null,
      // The nominee link is only meaningful once released.
      accessToken: g.status === 'released' ? g.accessToken : null,
    };
  }
}

/** Coerce the JSON `proofRefs` column into a typed array. */
function proofList(raw: Prisma.JsonValue | null | undefined): ProofRef[] {
  return Array.isArray(raw) ? (raw as unknown as ProofRef[]) : [];
}

function mintToken(): string {
  return randomBytes(24).toString('hex');
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
