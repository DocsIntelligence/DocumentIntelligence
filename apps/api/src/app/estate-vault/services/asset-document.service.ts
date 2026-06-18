import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { assetDetailGuidance, createAssetSchema, sanitizeDetails } from '@org/dto';
import type { NormalizedDocument } from '@org/doc-intelligence';
import { AiService } from '../../ai/ai.service';
import type { MultimodalPart } from '../../ai/providers/ai-provider.interface';
import { DatabaseService } from '../../database/database.service';
import { StorageService } from '../../storage/storage.service';
import { sourcePart } from '../../intelligence/engines/vlm-extraction.engine';
import {
  ParsingService,
  PdfPasswordRequiredError,
} from '../../intelligence/parsing.service';
import { errorMessage } from '../../common/error.util';
import { VaultCryptoService } from '../../vault/vault-crypto.service';
import { extractionGuidanceBlock } from '../estate.constants';
import { AssetService } from './asset.service';
import type { ResolvedProfile } from './estate-profile.service';
import type { CreateAssetDto } from '@org/dto';
import { EstateVaultConfigService } from './estate-vault-config.service';

/** A single extracted holding/asset suggestion (one row to review). */
export interface AssetSuggestion {
  type?: string;
  label?: string;
  institution?: string;
  value?: number;
  units?: number;
  identifier?: string;
  maturityDate?: string;
  currency?: string;
  /** Per-asset-type structured fields, sanitised against the shared registry. */
  details?: Record<string, string | number>;
}

/** Result of extracting EVERY holding from one statement (CAS), with a
 *  reconciliation against the statement's own printed grand total so an
 *  incomplete/truncated extraction is surfaced rather than silently wrong. */
export interface ExtractHoldingsResult {
  holdings: AssetSuggestion[];
  summary: {
    /** The portfolio grand total printed in the statement, if found. */
    statedTotal?: number;
    statementDate?: string;
    currency?: string;
  };
  reconciliation: {
    /** Sum of the extracted holdings' values. */
    extractedTotal: number;
    statedTotal?: number;
    /** (extracted − stated) / stated × 100, rounded. Negative = under-counted. */
    deltaPct?: number;
    /** True when |deltaPct| ≤ 1%. Null when the statement printed no total. */
    matched?: boolean;
    holdingsExtracted: number;
  };
}

/** Holdings whose summed value is within this %% of the stated total reconcile. */
const RECONCILE_TOLERANCE_PCT = 1;
/** Large CAS statements have many holdings; the model needs output headroom or
 *  the JSON array gets truncated mid-way (the under-count bug). */
const HOLDINGS_MAX_TOKENS = 32000;

/** Result of importing one file in a multi-file batch. */
export interface ImportFileResult {
  filename: string;
  status: 'created' | 'password_required' | 'password_incorrect' | 'failed';
  assetId?: string;
  label?: string;
  type?: string;
  value?: number;
  error?: string;
}

const STORAGE_FOLDER = 'estate-vault';

type AssetDocRow = Prisma.AssetDocumentGetPayload<Record<string, never>>;

/** Asset documents — periodic statements/policies, versioned by `slotKey` +
 *  `periodAsOf` (docs/13 §2.3), plus AI extract-assist that suggests asset
 *  fields from a statement (reuses StorageService + AiService like the vault). */
@Injectable()
export class AssetDocumentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
    private readonly config: EstateVaultConfigService,
    private readonly parsing: ParsingService,
    private readonly assets: AssetService,
    private readonly crypto: VaultCryptoService,
  ) {}

  /**
   * CAS hero-import (docs/13 §11.3): bulk-create the reviewed holdings AND keep
   * the original statement — stored once and attached to EVERY asset it produced,
   * with its open password retained (encrypted) so the owner can re-open or
   * re-extract it later without re-typing. Returns the bulk-create counts.
   */
  async bulkImportFromStatement(
    profile: ResolvedProfile,
    assets: CreateAssetDto[],
    file?: { buffer: Buffer; originalname: string; mimetype: string },
    password?: string,
  ): Promise<{ created: number; updated: number }> {
    const { created, updated, assetIds } = await this.assets.bulkCreate(
      profile,
      assets,
    );
    if (file && assetIds.length > 0) {
      await this.attachStatementToAssets(
        profile.ownerUserId,
        assetIds,
        file,
        password,
      );
    }
    return { created, updated };
  }

  /** Store one statement once in S3 and link a document row (sharing that
   *  s3Key) to each asset, retaining the encrypted open password. */
  private async attachStatementToAssets(
    userId: string,
    assetIds: string[],
    file: { buffer: Buffer; originalname: string; mimetype: string },
    password?: string,
  ): Promise<void> {
    const stored = await this.storage.upload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      folder: STORAGE_FOLDER,
      userId,
    });
    const passwordEnc = password ? this.crypto.encrypt(password) : null;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    await this.db.assetDocument.createMany({
      data: assetIds.map((assetId) => ({
        assetId,
        ownerUserId: userId,
        slotKey: 'source_statement',
        kind: 'cas',
        filename: file.originalname,
        contentType: file.mimetype,
        byteSize: file.buffer.length,
        s3Key: stored.key,
        checksum,
        passwordEnc,
      })),
    });
  }

  /**
   * Multi-file import (docs/13 §11.3): the user drops N statements/policies
   * (e.g. 10 insurance PDFs), optionally each with a password → we extract one
   * asset's fields per file, CREATE the asset, and ATTACH the file as its
   * document. Per-file isolation: one bad/locked file doesn't sink the batch —
   * it comes back as `password_required` / `failed` for the UI to surface.
   */
  async importFiles(
    profile: import('./estate-profile.service').ResolvedProfile,
    files: { buffer: Buffer; originalname: string; mimetype: string }[],
    passwords: (string | undefined)[],
  ): Promise<{ created: number; total: number; results: ImportFileResult[] }> {
    const results: ImportFileResult[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const pwd = passwords[i];
      try {
        const s = await this.suggest(
          f.mimetype,
          f.buffer.toString('base64'),
          pwd,
        );
        const dto = createAssetSchema.parse({
          type: s.type ?? 'other',
          label: clean(s.institution) ?? stripExt(f.originalname),
          institution: trunc(s.institution, 160),
          value: Number.isFinite(s.value as number) ? s.value : undefined,
          units: Number.isFinite(s.units as number) ? s.units : undefined,
          identifier: trunc(s.identifier, 120),
          maturityDate: isIsoDate(s.maturityDate) ? s.maturityDate : undefined,
          currency: /^[A-Z]{3}$/.test(s.currency ?? '') ? s.currency : 'INR',
        });
        const asset = await this.assets.create(profile, dto);
        await this.addDocument(profile.ownerUserId, asset.id, f, {
          kind: docKindFor(dto.type),
        });
        results.push({
          filename: f.originalname,
          status: 'created',
          assetId: asset.id,
          label: dto.label,
          type: dto.type,
          value: dto.value,
        });
      } catch (e) {
        const code = passwordCode(e);
        results.push({
          filename: f.originalname,
          status:
            code === 'PDF_PASSWORD_INCORRECT'
              ? 'password_incorrect'
              : code === 'PDF_PASSWORD_REQUIRED'
                ? 'password_required'
                : 'failed',
          ...(code ? {} : { error: errorMessage(e) }),
        });
      }
    }
    return {
      created: results.filter((r) => r.status === 'created').length,
      total: files.length,
      results,
    };
  }

  async addDocument(
    userId: string,
    assetId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
    opts: { kind?: string; slotKey?: string; periodAsOf?: string },
  ) {
    await this.requireAsset(userId, assetId);
    const stored = await this.storage.upload(file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
      folder: STORAGE_FOLDER,
      userId,
    });
    const doc = await this.db.assetDocument.create({
      data: {
        assetId,
        ownerUserId: userId,
        slotKey: opts.slotKey?.trim() || 'default',
        kind: opts.kind?.trim() || 'other',
        filename: file.originalname,
        contentType: file.mimetype,
        byteSize: file.buffer.length,
        s3Key: stored.key,
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
        periodAsOf: parseDate(opts.periodAsOf),
      },
    });
    return this.present(doc);
  }

  /** Documents for an asset, newest period first (latest version on top). */
  async listDocuments(userId: string, assetId: string) {
    await this.requireAsset(userId, assetId);
    const rows = await this.db.assetDocument.findMany({
      where: { assetId },
      orderBy: [{ periodAsOf: 'desc' }, { uploadedAt: 'desc' }],
    });
    return rows.map((d) => this.present(d));
  }

  async documentUrl(userId: string, assetId: string, docId: string) {
    await this.requireAsset(userId, assetId);
    const doc = await this.requireDoc(assetId, docId);
    const url = await this.storage.getPresignedDownloadUrl(doc.s3Key);
    return { url, filename: doc.filename, contentType: doc.contentType };
  }

  async removeDocument(userId: string, assetId: string, docId: string) {
    await this.requireAsset(userId, assetId);
    const doc = await this.requireDoc(assetId, docId);
    await this.storage.delete(doc.s3Key).catch(() => undefined);
    await this.db.assetDocument.delete({ where: { id: doc.id } });
    return { ok: true };
  }

  /** Suggest asset fields from an uploaded file (no asset yet) — powers
   *  autofill on the add-asset screen. Processed in-memory, not stored. */
  async extractFromUpload(file: {
    buffer: Buffer;
    mimetype: string;
    password?: string;
    /** The asset type the user has already picked — focuses the prompt. */
    assetType?: string;
  }) {
    return this.suggest(
      file.mimetype,
      file.buffer.toString('base64'),
      file.password,
      file.assetType,
    );
  }

  /** Extract EVERY holding from one statement (e.g. a CAMS/KFintech CAS) →
   *  an array of asset suggestions for review + bulk import (docs/13 §11.3). */
  async extractHoldingsFromUpload(file: {
    buffer: Buffer;
    mimetype: string;
    password?: string;
  }) {
    return this.suggestMany(
      file.mimetype,
      file.buffer.toString('base64'),
      file.password,
    );
  }

  /** Suggest asset fields from an already-attached document. */
  async extractFromDocument(
    userId: string,
    assetId: string,
    docId: string,
    password?: string,
  ) {
    await this.requireAsset(userId, assetId);
    const doc = await this.requireDoc(assetId, docId);
    // Fall back to the password we kept when this statement was imported, so a
    // protected CAS can be re-extracted without re-typing it.
    const pwd =
      password ??
      (doc.passwordEnc ? this.crypto.decrypt(doc.passwordEnc) : undefined);
    return this.suggest(doc.contentType, await this.base64(doc.s3Key), pwd);
  }

  /** Access-check only (owner of the asset owns the doc). Cheap — no parse. */
  async assertDocAccess(userId: string, assetId: string, docId: string) {
    await this.requireAsset(userId, assetId);
    await this.requireDoc(assetId, docId);
  }

  /**
   * Parse an attached document to normalized text — reusing the password we
   * kept when it was imported. Powers analysis + Q&A over the statement itself.
   * Returns nulls for unparseable / scanned-no-text-layer documents.
   */
  async normalizedTextForDoc(
    userId: string,
    assetId: string,
    docId: string,
  ): Promise<{ normalized: NormalizedDocument | null; text: string | null }> {
    await this.requireAsset(userId, assetId);
    const doc = await this.requireDoc(assetId, docId);
    if (!this.parsing.canParse(doc.contentType)) {
      return { normalized: null, text: null };
    }
    const password = doc.passwordEnc
      ? this.crypto.decrypt(doc.passwordEnc)
      : undefined;
    let normalized: NormalizedDocument | null = null;
    try {
      normalized = await this.parsing.parse({
        data: await this.base64(doc.s3Key),
        contentType: doc.contentType,
        password,
      });
    } catch (e) {
      if (e instanceof PdfPasswordRequiredError) {
        throw new BadRequestException({
          code: e.incorrect ? 'PDF_PASSWORD_INCORRECT' : 'PDF_PASSWORD_REQUIRED',
          message: e.message,
        });
      }
      throw e;
    }
    const text =
      normalized?.pages.map((p) => p.text).join('\n\n').trim() || null;
    return { normalized, text };
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async suggest(
    contentType: string,
    base64: string,
    password?: string,
    assetType?: string,
  ) {
    const types = await this.config.assetTypes(null);
    const keys = types.map((t) => t.key);
    // When the user has already chosen a type, focus the prompt + guidance on
    // it (far more accurate per-type extraction); the model may still correct
    // `assetType` if the document is clearly something else.
    const focusType =
      assetType && keys.includes(assetType) ? assetType : undefined;
    const focusLabel = focusType
      ? (types.find((t) => t.key === focusType)?.label ?? focusType)
      : undefined;
    const guidanceKeys = focusType ? [focusType] : keys;
    const parts = await this.sourceParts(contentType, base64, password);
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        assetType: {
          type: 'string',
          description: `Best-matching asset type, one of: ${keys.join(', ')}`,
        },
        institution: { type: 'string', description: 'Bank / AMC / insurer name' },
        value: { type: 'string', description: 'CURRENT value/balance (not invested/cost), digits only' },
        units: { type: 'string', description: 'Units/shares/grams held (digits + decimal), if applicable' },
        identifier: { type: 'string', description: 'Account / folio / policy number' },
        maturityDate: { type: 'string', description: 'YYYY-MM-DD if present' },
        currency: { type: 'string', description: 'ISO code; default INR' },
        details: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description:
            'Type-specific fields keyed per the guidance (e.g. fundHouse/folioNo/nav, sumAssured/premium). Omit anything not present.',
        },
      },
    } as unknown as Parameters<AiService['extract']>[1];

    const instruction = [
      focusType
        ? `This is a ${focusLabel} document (asset type \`${focusType}\`). Extract its fields accurately and completely. \`value\` must be digits only and must be the CURRENT value, not the invested/cost amount. Set \`assetType\` to \`${focusType}\` unless the document is CLEARLY a different kind — then pick the correct one from: ${keys.join(', ')}. Do not invent values; omit anything you cannot read.`
        : 'Read this Indian financial document (bank statement, mutual-fund/CAS statement, insurance policy, FD receipt, demat, EPF/NPS, etc.). Extract ONLY clearly legible fields; omit anything uncertain. `value` must be digits only (no commas or symbols) and must be the CURRENT value, not the invested/cost amount. Pick `assetType` from the allowed list. Do not invent values.',
      extractionGuidanceBlock(guidanceKeys),
      assetDetailGuidance(guidanceKeys),
    ]
      .filter(Boolean)
      .join('\n\n');

    const { data } = await this.ai.extract<Record<string, string>>(
      [{ kind: 'text', text: instruction }, ...parts],
      schema,
      {
        systemPrompt:
          'Extract structured fields from a financial document. Never fabricate values.',
        schemaName: 'estate_asset_scan',
        instruction,
      },
    );

    return mapSuggestion(data, keys);
  }

  private async suggestMany(
    contentType: string,
    base64: string,
    password?: string,
  ): Promise<ExtractHoldingsResult> {
    const types = await this.config.assetTypes(null);
    const keys = types.map((t) => t.key);
    const parts = await this.sourceParts(contentType, base64, password);
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        holdings: {
          type: 'array',
          description: 'One entry per holding/account/policy in the statement',
          items: {
            type: 'object',
            properties: {
              assetType: { type: 'string', description: `One of: ${keys.join(', ')}` },
              label: { type: 'string', description: 'Scheme/fund/account name' },
              institution: { type: 'string', description: 'AMC / bank / insurer' },
              value: { type: 'string', description: 'CURRENT market value (not invested/cost), digits only' },
              units: { type: 'string', description: 'Units/shares/grams held (digits + decimal), if applicable' },
              identifier: { type: 'string', description: 'Folio / account / policy number' },
              maturityDate: { type: 'string', description: 'YYYY-MM-DD if present' },
              currency: { type: 'string', description: 'ISO code; default INR' },
              details: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description:
                  'Type-specific fields keyed per the guidance (e.g. fundHouse/folioNo/nav for mutual_fund). Omit anything not present.',
              },
            },
          },
        },
        portfolioTotal: {
          type: 'string',
          description:
            'The GRAND TOTAL portfolio valuation printed in the statement summary (the "Total" figure across all holdings), digits only. Empty if the statement prints no total.',
        },
        statementDate: {
          type: 'string',
          description: 'Statement / as-on date, YYYY-MM-DD, if present',
        },
        currency: { type: 'string', description: 'ISO code; default INR' },
      },
    } as unknown as Parameters<AiService['extract']>[1];

    const instruction = [
      'Read this consolidated Indian financial statement (e.g. a CAMS/KFintech Consolidated Account Statement, demat holding statement, or portfolio summary). Extract EVERY holding/scheme/account/policy as a SEPARATE entry in `holdings` — do NOT stop early or summarise; a statement may list many dozens of holdings and you must return all of them. `value` must be the CURRENT market value (digits only), never the invested/cost amount. Also read the statement SUMMARY and report its printed grand total in `portfolioTotal` so the import can be reconciled. Pick `assetType` from the allowed list. Do not invent values; omit fields you cannot read.',
      extractionGuidanceBlock(keys),
      assetDetailGuidance(keys),
    ]
      .filter(Boolean)
      .join('\n\n');

    const { data } = await this.ai.extract<{
      holdings?: Record<string, string>[];
      portfolioTotal?: string;
      statementDate?: string;
      currency?: string;
    }>([{ kind: 'text', text: instruction }, ...parts], schema, {
      systemPrompt:
        'Extract every line item from a consolidated financial statement. Never fabricate values. Never truncate the holdings list.',
      schemaName: 'estate_holdings_scan',
      instruction,
      maxTokens: HOLDINGS_MAX_TOKENS,
    });

    const holdings = (data?.holdings ?? [])
      .map((row) => {
        const s = mapSuggestion(row, keys);
        return { ...s, label: clean(row?.['label']) ?? s.institution };
      })
      .filter(
        (s) => s.institution || s.identifier || s.value !== undefined || s.label,
      );

    const extractedTotal = round2(
      holdings.reduce((sum, h) => sum + (h.value ?? 0), 0),
    );
    const statedTotal = parseAmount(data?.portfolioTotal);
    const deltaPct =
      statedTotal && statedTotal > 0
        ? Math.round(((extractedTotal - statedTotal) / statedTotal) * 100)
        : undefined;
    const matched =
      deltaPct === undefined ? undefined : Math.abs(deltaPct) <= RECONCILE_TOLERANCE_PCT;

    return {
      holdings,
      summary: {
        statedTotal,
        statementDate: isIsoDate(data?.statementDate) ? data?.statementDate : undefined,
        currency: clean(data?.currency),
      },
      reconciliation: {
        extractedTotal,
        statedTotal,
        deltaPct,
        matched,
        holdingsExtracted: holdings.length,
      },
    };
  }

  /**
   * Build the AI input part(s) for a document — TEXT-FIRST: for PDFs/DOCX we
   * extract the text layer and send that (so text-only providers like OpenAI
   * chat work, and it's cheaper/more accurate than vision on born-digital docs).
   * Only scanned PDFs with no text layer, and images, fall back to `sourcePart`
   * (vision). A password-protected PDF surfaces a 400 so the caller can prompt.
   */
  private async sourceParts(
    contentType: string,
    base64: string,
    password?: string,
  ): Promise<MultimodalPart[]> {
    if (this.parsing.canParse(contentType)) {
      let text = '';
      try {
        const doc = await this.parsing.parse({
          data: base64,
          contentType,
          password,
        });
        text = (doc?.pages ?? [])
          .map((p) => p.text)
          .join('\n\n')
          .trim();
      } catch (e) {
        if (e instanceof PdfPasswordRequiredError) {
          throw new BadRequestException({
            code: e.incorrect
              ? 'PDF_PASSWORD_INCORRECT'
              : 'PDF_PASSWORD_REQUIRED',
            message: e.message,
          });
        }
        throw e;
      }
      if (text) {
        return [{ kind: 'text', text: `--- Document text ---\n${text}` }];
      }
      // No usable text layer (scanned) → fall through to vision/source.
    }
    return [sourcePart(contentType, base64)];
  }

  private async requireAsset(userId: string, assetId: string) {
    const asset = await this.db.asset.findFirst({
      where: { id: assetId, ownerUserId: userId },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
  }

  private async requireDoc(assetId: string, docId: string): Promise<AssetDocRow> {
    const doc = await this.db.assetDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.assetId !== assetId) {
      throw new NotFoundException('Document not found');
    }
    return doc;
  }

  private async base64(key: string): Promise<string> {
    const bytes = this.storage.isLocalBackend()
      ? await this.storage.readBuffer(key)
      : await fetch(await this.storage.getPresignedDownloadUrl(key)).then(
          async (r) => Buffer.from(await r.arrayBuffer()),
        );
    return bytes.toString('base64');
  }

  private present(d: AssetDocRow) {
    return {
      id: d.id,
      slotKey: d.slotKey,
      kind: d.kind,
      filename: d.filename,
      contentType: d.contentType,
      byteSize: d.byteSize,
      periodAsOf: d.periodAsOf ? d.periodAsOf.toISOString() : null,
      uploadedAt: d.uploadedAt.toISOString(),
    };
  }
}

/** Map one raw extracted record → an asset suggestion (type-gated, value parsed). */
function mapSuggestion(
  data: Record<string, string> | undefined,
  keys: string[],
): AssetSuggestion {
  const typeHint = data?.['assetType']?.trim();
  const type = typeHint && keys.includes(typeHint) ? typeHint : undefined;
  return {
    type,
    institution: clean(data?.['institution']),
    value: parseAmount(data?.['value']),
    units: parseAmount(data?.['units']),
    identifier: clean(data?.['identifier']),
    maturityDate: clean(data?.['maturityDate']),
    currency: clean(data?.['currency']),
    details: type
      ? sanitizeDetails(type, (data as Record<string, unknown>)?.['details'])
      : undefined,
  };
}

/** Parse a model-emitted numeric string ("₹12,34,567.89") → number, or undefined. */
function parseAmount(raw: string | undefined): number | undefined {
  const cleaned = raw?.replace(/[^0-9.]/g, '') ?? '';
  if (!cleaned) return undefined;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Strip a file extension for use as a fallback asset label. */
function stripExt(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '').trim() || filename;
}

function trunc(v: string | undefined, max: number): string | undefined {
  const t = clean(v);
  return t ? t.slice(0, max) : undefined;
}

function isIsoDate(v: string | undefined): boolean {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Map an asset type to the most fitting document kind for the attachment. */
function docKindFor(type: string): string {
  switch (type) {
    case 'insurance':
      return 'policy';
    case 'bank':
    case 'fixed_deposit':
      return 'bank_statement';
    case 'mutual_fund':
    case 'stocks':
      return 'cas';
    case 'property':
      return 'deed';
    default:
      return 'other';
  }
}

/** Extract the API error `code` from a thrown BadRequestException (password). */
function passwordCode(e: unknown): string | null {
  const resp = (e as { getResponse?: () => unknown })?.getResponse?.();
  if (resp && typeof resp === 'object') {
    const code = (resp as { code?: string }).code;
    if (code === 'PDF_PASSWORD_REQUIRED' || code === 'PDF_PASSWORD_INCORRECT') {
      return code;
    }
  }
  return null;
}
