import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { sourcePart } from '../intelligence/engines/vlm-extraction.engine';
import { VaultCryptoService } from './vault-crypto.service';
import { VaultConfigService } from './vault-config.service';
import { CreateVaultEntityDto, UpdateVaultEntityDto } from './vault.dto';
import { maskFields } from './vault.fields';

const STORAGE_FOLDER = 'vault';
const DOC_KINDS = new Set([
  'aadhaar',
  'pan',
  'passport',
  'incorporation',
  'gst',
  'other',
]);

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: VaultCryptoService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
    private readonly config: VaultConfigService,
  ) {}

  // ── Entities ────────────────────────────────────────────────────────────

  /** Server-paginated list — only the current page is fetched + decrypted, so
   *  it scales to many entities. Returns `{ items, total }`. */
  async list(
    userId: string,
    query: {
      q?: string;
      page: number;
      pageSize: number;
      sort: 'label' | 'kind' | 'updated' | 'documents';
      dir: 'asc' | 'desc';
    },
  ) {
    const orgIds = await this.userOrgIds(userId);
    const where: Prisma.VaultEntityWhereInput = {
      OR: [{ ownerUserId: userId }, { ownerOrgId: { in: orgIds } }],
    };
    if (query.q) where.label = { contains: query.q, mode: 'insensitive' };

    const orderBy: Prisma.VaultEntityOrderByWithRelationInput =
      query.sort === 'label'
        ? { label: query.dir }
        : query.sort === 'kind'
          ? { kind: query.dir }
          : query.sort === 'documents'
            ? { documents: { _count: query.dir } }
            : { updatedAt: query.dir };

    const [rows, total] = await this.db.$transaction([
      this.db.vaultEntity.findMany({
        where,
        orderBy,
        take: query.pageSize,
        skip: query.page * query.pageSize,
        include: { _count: { select: { documents: true } } },
      }),
      this.db.vaultEntity.count({ where }),
    ]);

    // Lean list — NO field decryption here. Fields are fetched per-entity via
    // get()/reveal() when one is selected (docs/10 + lean-CRUD rule).
    const items = rows.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      isActive: e.isActive,
      documentCount: e._count.documents,
      updatedAt: e.updatedAt,
    }));
    return { items, total };
  }

  /** Detail with MASKED fields + documents (no presigned URLs here). */
  async get(userId: string, id: string) {
    const e = await this.loadEntity(userId, id);
    const docs = await this.db.vaultDocument.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
    });
    const defs = await this.config.fieldDefs(e.ownerOrgId, e.kind);
    return {
      id: e.id,
      kind: e.kind,
      label: e.label,
      isActive: e.isActive,
      fields: maskFields(defs, this.crypto.decryptFields(e.dataEncrypted)),
      schema: defs,
      documents: docs.map((d) => ({
        id: d.id,
        kind: d.kind,
        filename: d.filename,
        contentType: d.contentType,
        byteSize: d.byteSize,
        createdAt: d.createdAt,
      })),
      updatedAt: e.updatedAt,
    };
  }

  /** Decrypted (UNMASKED) fields — for editing + autofill. Audited. */
  async reveal(userId: string, id: string) {
    const e = await this.loadEntity(userId, id);
    await this.audit(id, userId, 'reveal');
    return {
      id: e.id,
      kind: e.kind,
      label: e.label,
      fields: this.crypto.decryptFields(e.dataEncrypted),
      schema: await this.config.fieldDefs(e.ownerOrgId, e.kind),
    };
  }

  /** Canonical decrypted fields for document autofill. Audited as a reveal. */
  async autofill(userId: string, id: string) {
    const e = await this.loadEntity(userId, id);
    await this.audit(id, userId, 'reveal', 'autofill');
    return {
      id: e.id,
      kind: e.kind,
      label: e.label,
      fields: this.crypto.decryptFields(e.dataEncrypted),
    };
  }

  async create(userId: string, dto: CreateVaultEntityDto) {
    const entity = await this.db.vaultEntity.create({
      data: {
        ownerUserId: userId,
        kind: dto.kind,
        label: dto.label,
        dataEncrypted: this.crypto.encryptFields(this.clean(dto.fields)),
      },
    });
    await this.audit(entity.id, userId, 'create');
    return this.get(userId, entity.id);
  }

  async update(userId: string, id: string, dto: UpdateVaultEntityDto) {
    const e = await this.loadEntity(userId, id);
    const data: { label?: string; dataEncrypted?: string | null; isActive?: boolean } = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.fields !== undefined) {
      data.dataEncrypted = this.crypto.encryptFields(this.clean(dto.fields));
    }
    await this.db.vaultEntity.update({ where: { id: e.id }, data });
    await this.audit(id, userId, 'update');
    return this.get(userId, id);
  }

  /** Clone an entity (label "Copy of …") with its encrypted fields. Documents
   *  are NOT copied (originals stay with the source). Preserves owner scope. */
  async duplicate(userId: string, id: string) {
    const e = await this.loadEntity(userId, id);
    const copy = await this.db.vaultEntity.create({
      data: {
        ownerUserId: e.ownerOrgId ? null : userId,
        ownerOrgId: e.ownerOrgId,
        kind: e.kind,
        label: `Copy of ${e.label}`,
        dataEncrypted: e.dataEncrypted, // same key → ciphertext is portable
      },
    });
    await this.audit(copy.id, userId, 'create', `duplicate of ${id}`);
    return this.get(userId, copy.id);
  }

  async remove(userId: string, id: string) {
    const e = await this.loadEntity(userId, id);
    const docs = await this.db.vaultDocument.findMany({ where: { entityId: id } });
    // Best-effort: purge the S3 objects before the rows cascade away.
    await Promise.allSettled(docs.map((d) => this.storage.delete(d.s3Key)));
    await this.db.vaultEntity.delete({ where: { id: e.id } });
    this.logger.log(`Vault entity ${id} deleted by ${userId}`);
    return { id };
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  async addDocument(
    userId: string,
    id: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    kind: string,
  ) {
    await this.loadEntity(userId, id);
    const stored = await this.storage.upload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      folder: STORAGE_FOLDER,
      userId,
    });
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const doc = await this.db.vaultDocument.create({
      data: {
        entityId: id,
        kind: DOC_KINDS.has(kind) ? kind : 'other',
        filename: file.originalname,
        contentType: file.mimetype,
        byteSize: file.buffer.length,
        s3Key: stored.key,
        checksum,
      },
    });
    return {
      id: doc.id,
      kind: doc.kind,
      filename: doc.filename,
      contentType: doc.contentType,
      byteSize: doc.byteSize,
      createdAt: doc.createdAt,
    };
  }

  /** Short-lived presigned download URL for an attached document. Audited. */
  async documentUrl(userId: string, id: string, docId: string) {
    await this.loadEntity(userId, id);
    const doc = await this.db.vaultDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.entityId !== id) throw new NotFoundException('Document not found');
    await this.audit(id, userId, 'download', doc.filename);
    const url = await this.storage.getPresignedDownloadUrl(doc.s3Key);
    return { url, filename: doc.filename, contentType: doc.contentType };
  }

  async removeDocument(userId: string, id: string, docId: string) {
    await this.loadEntity(userId, id);
    const doc = await this.db.vaultDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.entityId !== id) throw new NotFoundException('Document not found');
    await this.storage.delete(doc.s3Key).catch(() => undefined);
    await this.db.vaultDocument.delete({ where: { id: docId } });
    return { id: docId };
  }

  // ── Scan an uploaded document → suggested field values (docs/10 Part B) ────

  /** Vision-extract the canonical fields a document kind can fill (e.g. an
   *  Aadhaar card → name/number/DOB/address). Returns SUGGESTIONS only — the
   *  client decides what to apply. Audited. Needs a vision-capable AI provider. */
  async scanDocument(userId: string, id: string, docId: string) {
    const entity = await this.loadEntity(userId, id);
    const doc = await this.db.vaultDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.entityId !== id) throw new NotFoundException('Document not found');

    const dk = await this.config.docKind(entity.ownerOrgId, doc.kind);
    const fieldList = await this.config.fieldDefs(entity.ownerOrgId, entity.kind);
    const defs = new Map(fieldList.map((f) => [f.key, f]));
    const keys = (dk?.fills ?? []).filter((k) => defs.has(k));
    if (keys.length === 0) {
      throw new BadRequestException(
        'This document type cannot be auto-scanned for the selected entity.',
      );
    }

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        keys.map((k) => [k, { type: 'string', description: defs.get(k)?.label }]),
      ),
    } as unknown as Parameters<AiService['extract']>[1];

    const instruction = `You are reading an Indian ${dk?.label ?? doc.kind}. Extract ONLY the listed fields that are clearly legible in the image/PDF; omit anything you are unsure about. Dates as YYYY-MM-DD. Aadhaar as 12 digits (no spaces). Do not invent values.`;
    const base64 = await this.base64(doc.s3Key);

    const { data } = await this.ai.extract<Record<string, string>>(
      [{ kind: 'text', text: instruction }, sourcePart(doc.contentType, base64)],
      schema,
      { systemPrompt: 'Extract structured fields from the identity/registration document. Never fabricate.', schemaName: 'vault_scan', instruction },
    );

    const suggestions: Record<string, string> = {};
    for (const k of keys) {
      const v = data?.[k];
      if (v != null && String(v).trim() !== '') suggestions[k] = String(v).trim();
    }
    await this.audit(id, userId, 'reveal', `scan:${doc.kind}`);
    return { documentId: docId, kind: doc.kind, suggestions };
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async base64(key: string): Promise<string> {
    const bytes = this.storage.isLocalBackend()
      ? await this.storage.readBuffer(key)
      : await fetch(await this.storage.getPresignedDownloadUrl(key)).then(
          async (r) => Buffer.from(await r.arrayBuffer()),
        );
    return bytes.toString('base64');
  }

  /** Drop empty values so we don't encrypt/store blanks. */
  private clean(fields: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields ?? {})) {
      if (v != null && String(v).trim() !== '') out[k] = String(v).trim();
    }
    return out;
  }

  private async userOrgIds(userId: string): Promise<string[]> {
    const rows = await this.db.orgMember.findMany({
      where: { userId },
      select: { orgId: true },
    });
    return rows.map((r) => r.orgId);
  }

  private async loadEntity(userId: string, id: string) {
    const e = await this.db.vaultEntity.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Vault entity not found');
    if (e.ownerUserId === userId) return e;
    if (e.ownerOrgId) {
      const m = await this.db.orgMember.findUnique({
        where: { orgId_userId: { orgId: e.ownerOrgId, userId } },
      });
      if (m) return e;
    }
    throw new ForbiddenException('Not allowed');
  }

  private async audit(
    entityId: string,
    userId: string,
    action: string,
    detail?: string,
  ): Promise<void> {
    await this.db.vaultAccessLog
      .create({ data: { entityId, userId, action, detail } })
      .catch((e) => this.logger.warn(`audit write failed: ${String(e)}`));
  }
}
