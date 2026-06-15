import { Injectable } from '@nestjs/common';
import type { LegalCitation as DbCitation } from '@prisma/client';
import {
  CITATIONS as CODE_CITATIONS,
  type Citation,
} from '@org/legal-reference';
import { DatabaseService } from '../database/database.service';

const CACHE_TTL_MS = 60_000;

/**
 * Read-side service for the legal-citation catalog.
 *
 * Resolution policy: DB rows over the in-code seed, merged by `id`. The code
 * array (`CITATIONS` from `@org/legal-reference`) is the ultimate fallback so
 * a fresh DB still works. The DB row is the authoritative source the moment
 * an admin edits anything.
 *
 * Cache: a single in-process map keyed by jurisdiction, refreshed every 60 s
 * or on explicit `invalidate()`. The catalog is small (tens to low-hundreds
 * of rows) and read on EVERY AI draft + every analyzer call, so the cache is
 * essential. Admin writes call `invalidate()` directly.
 */
@Injectable()
export class LegalReferenceService {
  private cache: { citations: Citation[]; expiresAt: number } | null = null;

  constructor(private readonly db: DatabaseService) {}

  /** Every active citation merged from DB + code, DB wins on `id`. */
  async list(): Promise<Citation[]> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.citations;

    const dbRows = await this.db.legalCitation.findMany({
      where: { isActive: true },
    });
    const byId = new Map<string, Citation>(
      CODE_CITATIONS.map((c) => [c.id, { ...c }]),
    );
    for (const row of dbRows) byId.set(row.id, this.toCitation(row));

    const citations = Array.from(byId.values());
    this.cache = { citations, expiresAt: now + CACHE_TTL_MS };
    return citations;
  }

  async get(id: string): Promise<Citation | null> {
    const all = await this.list();
    return all.find((c) => c.id === id) ?? null;
  }

  /**
   * Citations that explicitly apply to a doc type (e.g. legal_notice →
   * [ni.138, ni.141, ni.142]). The filler uses this to decide which
   * `{{applicable_law}}` placeholders to fill with what.
   */
  async applicableFor(docTypeKey: string): Promise<Citation[]> {
    if (!docTypeKey) return [];
    const all = await this.list();
    return all.filter((c) => c.appliesTo?.includes(docTypeKey));
  }

  /** Map a topic tag → matching citations. */
  async byTopic(topic: string): Promise<Citation[]> {
    const all = await this.list();
    return all.filter((c) => c.topics?.includes(topic));
  }

  /**
   * Reverse-resolve a repealed citation id (e.g. 'crpc.200') to the citation
   * that supersedes it (bnss.223). Used by the analyzer's stale-citation pass.
   */
  async successorOf(repealedId: string): Promise<Citation | null> {
    const all = await this.list();
    return all.find((c) => c.supersedes === repealedId) ?? null;
  }

  /** Public-only slice for the unauthenticated /law catalog. */
  async listPublic(): Promise<Citation[]> {
    const all = await this.list();
    // Public = either flagged isPublic on the DB row, or seed-only (code
    // citations default to public unless the DB row marks them private).
    const dbRows = await this.db.legalCitation.findMany({
      where: { isPublic: false },
      select: { id: true },
    });
    const privateIds = new Set(dbRows.map((r) => r.id));
    return all.filter((c) => !privateIds.has(c.id));
  }

  /** Force-drop the cache. Call from admin write handlers. */
  invalidate(): void {
    this.cache = null;
  }

  // ── Admin write surface ───────────────────────────────────────────────
  async createOrUpdate(input: Partial<Citation> & { id: string }) {
    const data = {
      id: input.id,
      act: input.act ?? 'Unknown act',
      actShort: input.actShort ?? null,
      section: input.section ?? null,
      title: input.title ?? 'Untitled',
      summary: input.summary ?? '',
      externalUrl: input.externalUrl ?? null,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      supersedes: input.supersedes ?? null,
      confidence: input.confidence ?? 'moderate',
      verifyNote: input.verifyNote ?? null,
      topics: input.topics ?? [],
      appliesTo: input.appliesTo ?? [],
      commonlyPairedWith: input.commonlyPairedWith ?? [],
      draftingTips: input.draftingTips ?? null,
      jurisdiction: input.jurisdiction ?? 'IN',
    };
    const row = await this.db.legalCitation.upsert({
      where: { id: input.id },
      create: data,
      update: data,
    });
    this.invalidate();
    return this.toCitation(row);
  }

  async setActive(id: string, isActive: boolean) {
    await this.db.legalCitation.update({ where: { id }, data: { isActive } });
    this.invalidate();
  }

  async setPublic(id: string, isPublic: boolean) {
    await this.db.legalCitation.update({ where: { id }, data: { isPublic } });
    this.invalidate();
  }

  async remove(id: string) {
    await this.db.legalCitation.delete({ where: { id } });
    this.invalidate();
  }

  /** Admin listing — paginated + searchable; merges in-code seed with DB rows
   *  (DB wins) and tags each with `source: 'db' | 'code'` so the UI can
   *  disable destructive actions on the read-only seed. */
  async listAdmin(query: {
    q?: string;
    page?: number;
    pageSize?: number;
    sort?: 'id' | 'title' | 'act';
    dir?: 'asc' | 'desc';
  } = {}): Promise<{
    items: Array<
      Citation & { isActive: boolean; isPublic: boolean; source: 'db' | 'code' }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const dbRows = await this.db.legalCitation.findMany({});
    const dbById = new Map(dbRows.map((r) => [r.id, r]));
    const merged: Array<
      Citation & { isActive: boolean; isPublic: boolean; source: 'db' | 'code' }
    > = [];
    for (const c of CODE_CITATIONS) {
      const row = dbById.get(c.id);
      if (row) {
        merged.push({
          ...this.toCitation(row),
          isActive: row.isActive,
          isPublic: row.isPublic,
          source: 'db',
        });
        dbById.delete(c.id);
      } else {
        merged.push({ ...c, isActive: true, isPublic: true, source: 'code' });
      }
    }
    for (const row of dbById.values()) {
      merged.push({
        ...this.toCitation(row),
        isActive: row.isActive,
        isPublic: row.isPublic,
        source: 'db',
      });
    }

    // Free-text filter across id, act, section, title, summary, topics, appliesTo.
    let filtered = merged;
    if (query.q) {
      const q = query.q.toLowerCase().trim();
      filtered = merged.filter((c) =>
        [
          c.id,
          c.act,
          c.actShort ?? '',
          c.section ?? '',
          c.title,
          c.summary,
          ...(c.topics ?? []),
          ...(c.appliesTo ?? []),
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    // Sort.
    const sortKey = query.sort ?? 'id';
    const dir = query.dir ?? 'asc';
    filtered.sort((a, b) => {
      const av = String(a[sortKey as keyof typeof a] ?? '').toLowerCase();
      const bv = String(b[sortKey as keyof typeof b] ?? '').toLowerCase();
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

    // Paginate.
    const page = Math.max(0, query.page ?? 0);
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));
    const items = filtered.slice(page * pageSize, (page + 1) * pageSize);
    return { items, total: filtered.length, page, pageSize };
  }

  // ── helpers ─────────────────────────────────────────────────────────────
  private toCitation(row: DbCitation): Citation {
    return {
      id: row.id,
      act: row.act,
      actShort: row.actShort ?? undefined,
      section: row.section ?? undefined,
      title: row.title,
      summary: row.summary,
      effectiveFrom: row.effectiveFrom
        ? row.effectiveFrom.toISOString().slice(0, 10)
        : undefined,
      supersedes: row.supersedes ?? undefined,
      confidence: (row.confidence as Citation['confidence']) ?? 'moderate',
      verifyNote: row.verifyNote ?? undefined,
      topics: row.topics ?? [],
      appliesTo: row.appliesTo ?? [],
      commonlyPairedWith: row.commonlyPairedWith ?? [],
      jurisdiction: row.jurisdiction ?? undefined,
      draftingTips: row.draftingTips ?? undefined,
      externalUrl: row.externalUrl ?? undefined,
    };
  }
}
