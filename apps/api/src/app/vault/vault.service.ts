import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { VaultCryptoService } from './vault-crypto.service';
import { CreateVaultEntityDto, UpdateVaultEntityDto } from './vault.dto';
import { fieldDefs, maskFields } from './vault.fields';

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
  ) {}

  // ── Entities ────────────────────────────────────────────────────────────

  async list(userId: string) {
    const orgIds = await this.userOrgIds(userId);
    const rows = await this.db.vaultEntity.findMany({
      where: {
        OR: [{ ownerUserId: userId }, { ownerOrgId: { in: orgIds } }],
      },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { documents: true } } },
    });
    // List view: kind + label + doc count + a few masked fields for preview.
    return rows.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      documentCount: e._count.documents,
      fields: maskFields(e.kind, this.crypto.decryptFields(e.dataEncrypted)),
      updatedAt: e.updatedAt,
    }));
  }

  /** Detail with MASKED fields + documents (no presigned URLs here). */
  async get(userId: string, id: string) {
    const e = await this.loadEntity(userId, id);
    const docs = await this.db.vaultDocument.findMany({
      where: { entityId: id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      id: e.id,
      kind: e.kind,
      label: e.label,
      fields: maskFields(e.kind, this.crypto.decryptFields(e.dataEncrypted)),
      schema: fieldDefs(e.kind),
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
      schema: fieldDefs(e.kind),
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
    const data: { label?: string; dataEncrypted?: string | null } = {};
    if (dto.label !== undefined) data.label = dto.label;
    if (dto.fields !== undefined) {
      data.dataEncrypted = this.crypto.encryptFields(this.clean(dto.fields));
    }
    await this.db.vaultEntity.update({ where: { id: e.id }, data });
    await this.audit(id, userId, 'update');
    return this.get(userId, id);
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

  // ── Helpers ─────────────────────────────────────────────────────────────

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
