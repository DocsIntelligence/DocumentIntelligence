import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { SearchConfigService } from './search-config.service';
import { SearchTextService, ExtractedText } from './search-text.service';
import {
  SEARCH_QUEUE,
  SEARCH_QUEUE_ENABLED,
  SearchIndexJob,
} from './search.processor';

type Kind = 'document' | 'source';

/** Max characters fed to the embedding model (text-embedding-3-small ≈ 8k tokens). */
const EMBED_CHAR_BUDGET = 24_000;

function hashText(title: string, body: string): string {
  return createHash('sha256').update(`${title}\n${body}`).digest('hex');
}

/** Serialise a JS number[] to a pgvector literal: '[0.1,0.2,...]'. */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

/**
 * Maintains the unified `SearchIndex`. Public API: `enqueue*` (fire-and-forget,
 * used by write paths) and `indexNow`/`removeNow` (synchronous, used by the
 * BullMQ processor, the inline fallback, and the backfill). Embedding is gated
 * by the effective `SearchConfig` + provider availability + a content hash so
 * unchanged text is never re-embedded.
 */
@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(
    @Optional()
    @InjectQueue(SEARCH_QUEUE)
    private readonly queue: Queue | null,
    @Inject(SEARCH_QUEUE_ENABLED) private readonly queueEnabled: boolean,
    private readonly db: DatabaseService,
    private readonly text: SearchTextService,
    private readonly config: SearchConfigService,
    private readonly ai: AiService,
  ) {}

  // ── Enqueue (write paths call these; never block the request) ───────────

  enqueueDocument(refId: string, op: 'upsert' | 'remove' = 'upsert'): void {
    this.enqueue({ kind: 'document', refId, op });
  }

  enqueueSource(refId: string, op: 'upsert' | 'remove' = 'upsert'): void {
    this.enqueue({ kind: 'source', refId, op });
  }

  private enqueue(job: SearchIndexJob): void {
    if (this.queueEnabled && this.queue) {
      void this.queue
        .add(job.op, job, { removeOnComplete: 100, removeOnFail: 200 })
        .catch((e) => this.logger.error(`enqueue failed: ${String(e)}`));
      return;
    }
    // No Redis — run inline, fire-and-forget (status/index converge identically).
    setImmediate(() => {
      const run = job.op === 'remove'
        ? this.removeNow(job.kind, job.refId)
        : this.indexNow(job.kind, job.refId);
      void run.catch((e) =>
        this.logger.error(`inline index ${job.kind}:${job.refId} failed: ${String(e)}`),
      );
    });
  }

  // ── Synchronous index maintenance ───────────────────────────────────────

  async indexNow(kind: Kind, refId: string): Promise<void> {
    const extracted =
      kind === 'document'
        ? await this.text.forDocument(refId)
        : await this.text.forSource(refId);
    if (!extracted) {
      // Source/document vanished before indexing — drop any stale row.
      await this.removeNow(kind, refId);
      return;
    }
    await this.writeRow(kind, refId, extracted);
  }

  async removeNow(kind: Kind, refId: string): Promise<void> {
    await this.db.searchIndex.deleteMany({ where: { kind, refId } });
  }

  private async writeRow(kind: Kind, refId: string, t: ExtractedText): Promise<void> {
    const contentHash = hashText(t.title, t.bodyText);

    // Inspect the existing row (contentHash + whether it still needs an embedding).
    const existing = await this.db.$queryRawUnsafe<
      { contentHash: string; needsEmbed: boolean }[]
    >(
      'SELECT "contentHash", (embedding IS NULL) AS "needsEmbed" FROM "SearchIndex" WHERE kind = $1 AND "refId" = $2',
      kind,
      refId,
    );
    const prev = existing[0];
    const textChanged = !prev || prev.contentHash !== contentHash;

    // Upsert the scalar columns via the typed client (tsv is a generated column
    // and recomputes automatically; embedding is handled separately below).
    await this.db.searchIndex.upsert({
      where: { kind_refId: { kind, refId } },
      create: {
        kind,
        refId,
        ownerUserId: t.ownerUserId,
        ownerOrgId: t.ownerOrgId,
        title: t.title,
        bodyText: t.bodyText,
        contentHash,
        type: t.type,
        status: t.status,
        refUpdatedAt: t.refUpdatedAt,
      },
      update: {
        ownerUserId: t.ownerUserId,
        ownerOrgId: t.ownerOrgId,
        title: t.title,
        bodyText: t.bodyText,
        contentHash,
        type: t.type,
        status: t.status,
        refUpdatedAt: t.refUpdatedAt,
      },
    });

    // (Re)embed only when the text changed, or a row exists with no embedding.
    const needsEmbed = textChanged || (prev?.needsEmbed ?? true);
    if (needsEmbed) await this.maybeEmbed(kind, refId, t);
  }

  private async maybeEmbed(kind: Kind, refId: string, t: ExtractedText): Promise<void> {
    const cfg = await this.config.getEffective(t.ownerOrgId);
    if (!cfg.semanticEnabled || !this.ai.canEmbed()) return;
    const input = `${t.title}\n${t.bodyText}`.slice(0, EMBED_CHAR_BUDGET).trim();
    if (!input) return;
    try {
      const [vec] = await this.ai.embed([input]);
      if (!vec?.length) return;
      await this.db.$executeRawUnsafe(
        'UPDATE "SearchIndex" SET embedding = $1::vector WHERE kind = $2 AND "refId" = $3',
        toVectorLiteral(vec),
        kind,
        refId,
      );
    } catch (e) {
      // Keyword index still works; embedding is best-effort.
      this.logger.warn(`embed ${kind}:${refId} failed: ${String(e)}`);
    }
  }

  // ── Backfill (one-shot reindex of everything; safe to re-run) ────────────

  async backfillAll(): Promise<{ documents: number; sources: number }> {
    const docs = await this.db.document.findMany({ select: { id: true } });
    for (const d of docs) {
      await this.indexNow('document', d.id).catch((e) =>
        this.logger.error(`backfill doc ${d.id}: ${String(e)}`),
      );
    }
    const srcs = await this.db.sourceDocument.findMany({ select: { id: true } });
    for (const s of srcs) {
      await this.indexNow('source', s.id).catch((e) =>
        this.logger.error(`backfill source ${s.id}: ${String(e)}`),
      );
    }
    this.logger.log(`backfill complete: ${docs.length} docs, ${srcs.length} sources`);
    return { documents: docs.length, sources: srcs.length };
  }
}
