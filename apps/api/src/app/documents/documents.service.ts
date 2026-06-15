import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Document, Feature, PageSize, Prisma } from '@prisma/client';
import {
  appendSignaturesToHtml,
  type SignatureSignerInput,
} from '@org/legal-reference';
import { DatabaseService } from '../database/database.service';
import { WalletUsageService } from '../payment/wallet-usage.service';
import { SearchIndexService } from '../search/search-index.service';
import {
  CreateDocumentDto,
  ListDocumentsQueryDto,
  PatchDocumentDto,
} from './documents.dto';

/**
 * Documents service. All routes are scoped to the authenticated user.
 * Org-owned documents require the user to be a member of the org (enforced
 * in `assertCanAccess`).
 *
 * Quota enforcement: creating a document decrements the `documents`
 * WalletUsage feature once. PATCH/export do not decrement. If the user's
 * plan does not include enough quota, create is rejected with 403.
 *
 * Schema validation of `Document.data` against the type's Zod schema is
 * deliberately deferred to the libs/document-schema registry (Phase 1
 * task 1.7) — this stub stores `data` as-is so the builder can autosave
 * partial drafts.
 */
const FREEFORM_TYPE_KEY = 'freeform';
const FREEFORM_TEMPLATE_KEY = 'freeform';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly walletUsage: WalletUsageService,
    private readonly searchIndex: SearchIndexService,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────

  async list(userId: string, query: ListDocumentsQueryDto) {
    const where: Prisma.DocumentWhereInput = {
      OR: [
        { ownerUserId: userId },
        query.orgId
          ? {
              ownerOrgId: query.orgId,
              ownerOrg: { members: { some: { userId } } },
            }
          : undefined,
      ].filter(Boolean) as Prisma.DocumentWhereInput[],
    };

    if (query.status) where.status = query.status;
    if (query.documentTypeKey) {
      where.documentType = { key: query.documentTypeKey };
    }
    if (query.groupId) {
      where.groupId = query.groupId;
    }
    if (query.q) {
      where.title = { contains: query.q, mode: 'insensitive' };
    }

    const dir = query.dir;
    const orderBy: Prisma.DocumentOrderByWithRelationInput =
      query.sort === 'title'
        ? { title: dir }
        : query.sort === 'type'
          ? { documentType: { name: dir } }
          : query.sort === 'status'
            ? { status: dir }
            : query.sort === 'created'
              ? { createdAt: dir }
              : { updatedAt: dir };

    // Offset pagination + total count, both over the same filter, so the
    // client can render real page N / M and search/sort across the FULL set
    // (not just a pre-fetched window).
    const [items, total] = await this.db.$transaction([
      this.db.document.findMany({
        where,
        orderBy,
        take: query.pageSize,
        skip: query.page * query.pageSize,
        include: {
          documentType: { select: { key: true, name: true } },
          template: { select: { key: true, name: true } },
          group: { select: { id: true, name: true, kind: true } },
        },
      }),
      this.db.document.count({ where }),
    ]);

    return { items, total };
  }

  async getById(userId: string, id: string) {
    const doc = await this.db.document.findUnique({
      where: { id },
      include: {
        documentType: true,
        template: true,
        signers: { orderBy: { order: 'asc' } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertCanAccess(userId, doc);
    return doc;
  }

  // ─── Create ────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateDocumentDto) {
    // Freeform / AI-drafted documents don't ship in the curated seed; provision
    // the catalog rows on demand so persistence works on any DB state.
    if (dto.documentTypeKey === FREEFORM_TYPE_KEY) {
      await this.ensureFreeformType();
    }

    const type = await this.db.documentType.findUnique({
      where: { key: dto.documentTypeKey },
    });
    if (!type || !type.isActive) {
      throw new BadRequestException(
        `Unknown document type: ${dto.documentTypeKey}`,
      );
    }

    const template = await this.db.documentTemplate.findUnique({
      where: {
        documentTypeId_key: { documentTypeId: type.id, key: dto.templateKey },
      },
    });
    if (!template || !template.isActive) {
      throw new BadRequestException(
        `Unknown template "${dto.templateKey}" for type "${dto.documentTypeKey}"`,
      );
    }

    // Quota check (existing wallet usage system).
    const ok = await this.walletUsage.checkQuota(userId, Feature.documents);
    if (!ok) {
      throw new ForbiddenException(
        'Document quota exhausted. Upgrade your plan to create more documents.',
      );
    }

    if (dto.ownerOrgId) {
      const member = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: dto.ownerOrgId, userId } },
      });
      if (!member) throw new ForbiddenException('Not a member of this org');
    }

    const doc = await this.db.document.create({
      data: {
        title: dto.title,
        documentTypeId: type.id,
        templateId: template.id,
        ownerType: dto.ownerOrgId ? 'organisation' : 'user',
        ownerUserId: dto.ownerOrgId ? null : userId,
        ownerOrgId: dto.ownerOrgId ?? null,
        pageSize: dto.pageSize ?? type.defaultPageSize,
        language: dto.language ?? template.language,
        jurisdiction: dto.jurisdiction ?? null,
        data: dto.data as Prisma.InputJsonValue,
      },
    });

    await this.walletUsage.trackUsage(userId, Feature.documents, 1);

    this.searchIndex.enqueueDocument(doc.id);
    return doc;
  }

  /**
   * Clone a document the user can access into a fresh user-owned draft ("Copy
   * of …"), preserving type/template/data/pageSize/language. Subject to the same
   * document quota as create. The copy is always user-owned (never inherits a
   * signed/locked state), so it opens as an editable draft.
   */
  async duplicate(userId: string, id: string) {
    const src = await this.getById(userId, id);

    const ok = await this.walletUsage.checkQuota(userId, Feature.documents);
    if (!ok) {
      throw new ForbiddenException(
        'Document quota exhausted. Upgrade your plan to create more documents.',
      );
    }

    const copy = await this.db.document.create({
      data: {
        title: `Copy of ${src.title}`,
        documentTypeId: src.documentTypeId,
        templateId: src.templateId,
        ownerType: 'user',
        ownerUserId: userId,
        ownerOrgId: null,
        pageSize: src.pageSize,
        language: src.language,
        jurisdiction: src.jurisdiction,
        data: (src.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.walletUsage.trackUsage(userId, Feature.documents, 1);
    this.searchIndex.enqueueDocument(copy.id);
    this.logger.log(`Duplicated document ${id} → ${copy.id}`);
    return copy;
  }

  // ─── Patch (autosave) ──────────────────────────────────────────────────

  async patch(userId: string, id: string, dto: PatchDocumentDto) {
    const existing = await this.db.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document not found');
    await this.assertCanAccess(userId, existing);
    if (existing.lockedAt) {
      throw new ForbiddenException(
        'Document is locked (signed). Create a new draft to amend.',
      );
    }

    let templateId = existing.templateId;
    if (dto.templateKey) {
      const t = await this.db.documentTemplate.findUnique({
        where: {
          documentTypeId_key: {
            documentTypeId: existing.documentTypeId,
            key: dto.templateKey,
          },
        },
      });
      if (!t) throw new BadRequestException('Unknown templateKey');
      templateId = t.id;
    }

    const updated = await this.db.document.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        data:
          dto.data === undefined
            ? undefined
            : (dto.data as Prisma.InputJsonValue),
        pageSize: dto.pageSize ?? undefined,
        language: dto.language ?? undefined,
        jurisdiction: dto.jurisdiction ?? undefined,
        templateId,
        status: dto.status ?? undefined,
      },
      // Same shape as getById so the frontend's setQueryData replace
      // doesn't drop the documentType/template relations between edits.
      include: {
        documentType: true,
        template: true,
        signers: { orderBy: { order: 'asc' } },
      },
    });

    // Re-index (title/content/status may have changed). Fire-and-forget; the
    // indexer skips re-embedding when the extracted text is unchanged.
    this.searchIndex.enqueueDocument(id);
    return updated;
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────

  async snapshot(userId: string, id: string, label?: string) {
    const doc = await this.db.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertCanAccess(userId, doc);

    return this.db.documentVersion.create({
      data: {
        documentId: doc.id,
        data: doc.data as Prisma.InputJsonValue,
        templateId: doc.templateId,
        pageSize: doc.pageSize,
        label,
        createdById: userId,
      },
    });
  }

  // ─── Version history ─────────────────────────────────────────────────────

  async listVersions(userId: string, id: string) {
    const doc = await this.db.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertCanAccess(userId, doc);
    return this.db.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        label: true,
        pageSize: true,
        createdAt: true,
        createdById: true,
      },
    });
  }

  async restoreVersion(userId: string, id: string, versionId: string) {
    const doc = await this.db.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertCanAccess(userId, doc);
    if (doc.lockedAt) {
      throw new ForbiddenException('Document is locked (signed).');
    }
    const version = await this.db.documentVersion.findUnique({
      where: { id: versionId },
    });
    if (!version || version.documentId !== id) {
      throw new NotFoundException('Version not found');
    }
    // Snapshot the current state first, so a restore is itself reversible.
    await this.db.documentVersion.create({
      data: {
        documentId: doc.id,
        data: doc.data as Prisma.InputJsonValue,
        templateId: doc.templateId,
        pageSize: doc.pageSize,
        label: 'Auto-snapshot before restore',
        createdById: userId,
      },
    });
    const restored = await this.db.document.update({
      where: { id },
      data: {
        data: version.data as Prisma.InputJsonValue,
        templateId: version.templateId,
        pageSize: version.pageSize,
      },
      include: {
        documentType: true,
        template: true,
        signers: { orderBy: { order: 'asc' } },
      },
    });
    this.searchIndex.enqueueDocument(id);
    return restored;
  }

  // ─── Delete ────────────────────────────────────────────────────────────

  async remove(userId: string, id: string) {
    const doc = await this.db.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.assertCanAccess(userId, doc, { requireOwner: true });
    const deleted = await this.db.document.delete({ where: { id } });
    this.searchIndex.enqueueDocument(id, 'remove');
    return deleted;
  }

  // ─── Catalog (public read-only) ────────────────────────────────────────

  async listTypes() {
    return this.db.documentType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        templates: {
          where: { isActive: true, ownerType: null },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // ─── Internal: render-payload for the artboard ──────────────────────────
  // Called by the PDF render worker (Puppeteer) and by apps/artboard's
  // /render route. Authenticated by INTERNAL_RENDER_TOKEN, NOT by the
  // user's session. Returns the minimum needed to draw a page.

  async renderPayload(id: string, token: string) {
    const expected = process.env.INTERNAL_RENDER_TOKEN;
    if (!expected) {
      throw new ForbiddenException('Render endpoint disabled (no token set)');
    }
    if (token !== expected) {
      throw new ForbiddenException('Invalid render token');
    }
    const doc = await this.db.document.findUnique({
      where: { id },
      include: { template: true },
    });
    if (!doc) throw new NotFoundException('Document not found');

    // For freeform/HTML documents, render captured signatures (+ audit page)
    // into the body so the exported PDF includes them.
    let data = doc.data;
    const body = data as { html?: unknown } | null;
    if (body && typeof body.html === 'string') {
      const signers = await this.db.documentSigner.findMany({
        where: { documentId: id },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });
      if (signers.length > 0) {
        const mapped: SignatureSignerInput[] = signers.map((s) => {
          const ev = (s.evidence ?? {}) as Record<string, unknown>;
          const str = (v: unknown) => (typeof v === 'string' ? v : null);
          return {
            name: s.name,
            email: s.email,
            role: s.role,
            status: s.status,
            method: s.provider ?? str(ev.method),
            image: str(ev.image),
            typedText: str(ev.typedText),
            font: str(ev.font),
            signedAt: s.signedAt ? s.signedAt.toISOString() : str(ev.signedAt),
            ip: str(ev.ip),
            userAgent: str(ev.userAgent),
          };
        });
        data = {
          ...(body as object),
          html: appendSignaturesToHtml(body.html, mapped),
        } as Prisma.JsonValue;
      }
    }

    return {
      componentKey: doc.template.componentKey,
      data,
      pageSize: doc.pageSize,
      language: doc.language,
      jurisdiction: doc.jurisdiction,
    };
  }

  // ─── Freeform type provisioning ─────────────────────────────────────────
  // Idempotent: ensures the `freeform` DocumentType + its `freeform` template
  // exist so the editor/AI-draft flow can persist arbitrary HTML documents.

  private async ensureFreeformType() {
    const type = await this.db.documentType.upsert({
      where: { key: FREEFORM_TYPE_KEY },
      update: {},
      create: {
        key: FREEFORM_TYPE_KEY,
        name: 'Freeform / AI Draft',
        category: 'general',
        description:
          'Free-form document drafted in the editor or generated by AI.',
        schema: {} as Prisma.InputJsonValue,
        defaultPageSize: PageSize.a4,
        jurisdictions: ['IN-*'],
        iconKey: 'file-text',
        sortOrder: 100,
      },
    });
    await this.db.documentTemplate.upsert({
      where: {
        documentTypeId_key: {
          documentTypeId: type.id,
          key: FREEFORM_TEMPLATE_KEY,
        },
      },
      update: {},
      create: {
        documentTypeId: type.id,
        key: FREEFORM_TEMPLATE_KEY,
        name: 'Freeform',
        componentKey: 'freeform',
        jurisdictions: ['IN-*'],
        language: 'en',
      },
    });
  }

  // ─── Authorization helper ──────────────────────────────────────────────

  private async assertCanAccess(
    userId: string,
    doc: Document,
    opts: { requireOwner?: boolean } = {},
  ) {
    if (doc.ownerUserId === userId) return;
    if (doc.ownerOrgId) {
      const member = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: doc.ownerOrgId, userId } },
      });
      if (member) {
        if (
          opts.requireOwner &&
          member.role !== 'owner' &&
          member.role !== 'admin'
        ) {
          throw new ForbiddenException('Owner/admin role required');
        }
        return;
      }
    }
    throw new ForbiddenException('Not allowed');
  }
}
