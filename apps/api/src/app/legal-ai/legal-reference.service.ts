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
   * Single citation for the ADMIN editor — unlike `get`, this includes
   * INACTIVE citations (otherwise an admin could never re-open one they'd
   * deactivated) and carries the live `isActive` / `isPublic` / `fullText`
   * the editor needs to hydrate its toggles. Reads the DB row directly (not
   * the active-only cache), falling back to the code seed.
   */
  async getAdmin(id: string): Promise<
    | (Citation & {
        isActive: boolean;
        isPublic: boolean;
        fullText?: string;
        source: 'db' | 'code';
      })
    | null
  > {
    const row = await this.db.legalCitation.findUnique({ where: { id } });
    if (row) {
      return {
        ...this.toCitation(row),
        fullText: row.fullText ?? undefined,
        isActive: row.isActive,
        isPublic: row.isPublic,
        source: 'db',
      };
    }
    const code = CODE_CITATIONS.find((c) => c.id === id);
    if (code) {
      return { ...code, isActive: true, isPublic: true, source: 'code' };
    }
    return null;
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
  /**
   * Upsert a citation. Only the columns actually present in `input` are
   * written, so PARTIAL callers (e.g. the indiacode sync, which carries just
   * summary + fullText + url) never clobber fields they didn't touch — and a
   * sync no longer resets `isActive` / `isPublic`. Semantics:
   *   • `undefined` → leave the column untouched (on update);
   *   • `null`      → clear the column;
   *   • a value     → set it.
   * The `create` branch backfills NOT-NULL columns with sensible defaults so a
   * brand-new id still inserts cleanly.
   */
  async createOrUpdate(
    input: Partial<Citation> & {
      id: string;
      fullText?: string | null;
      isActive?: boolean;
      isPublic?: boolean;
    },
  ) {
    const set: Record<string, unknown> = {};
    const put = (key: string, val: unknown) => {
      if (val !== undefined) set[key] = val;
    };
    put('act', input.act);
    put('actShort', input.actShort);
    put('section', input.section);
    put('title', input.title);
    put('summary', input.summary);
    put('fullText', input.fullText);
    put('externalUrl', input.externalUrl);
    put(
      'effectiveFrom',
      input.effectiveFrom === undefined
        ? undefined
        : input.effectiveFrom === null
          ? null
          : new Date(input.effectiveFrom),
    );
    put('supersedes', input.supersedes);
    put('confidence', input.confidence);
    put('verifyNote', input.verifyNote);
    put('topics', input.topics);
    put('appliesTo', input.appliesTo);
    put('commonlyPairedWith', input.commonlyPairedWith);
    put('draftingTips', input.draftingTips);
    put('jurisdiction', input.jurisdiction);
    put('isActive', input.isActive);
    put('isPublic', input.isPublic);

    const row = await this.db.legalCitation.upsert({
      where: { id: input.id },
      update: set,
      create: {
        id: input.id,
        act: (set.act as string | undefined) ?? 'Unknown act',
        actShort: (set.actShort as string | null | undefined) ?? null,
        section: (set.section as string | null | undefined) ?? null,
        title: (set.title as string | undefined) ?? 'Untitled',
        summary: (set.summary as string | undefined) ?? '',
        fullText: (set.fullText as string | null | undefined) ?? null,
        externalUrl: (set.externalUrl as string | null | undefined) ?? null,
        effectiveFrom: (set.effectiveFrom as Date | null | undefined) ?? null,
        supersedes: (set.supersedes as string | null | undefined) ?? null,
        confidence: (set.confidence as string | undefined) ?? 'moderate',
        verifyNote: (set.verifyNote as string | null | undefined) ?? null,
        topics: (set.topics as string[] | undefined) ?? [],
        appliesTo: (set.appliesTo as string[] | undefined) ?? [],
        commonlyPairedWith:
          (set.commonlyPairedWith as string[] | undefined) ?? [],
        draftingTips: (set.draftingTips as string | null | undefined) ?? null,
        jurisdiction: (set.jurisdiction as string | undefined) ?? 'IN',
        isActive: (set.isActive as boolean | undefined) ?? true,
        isPublic: (set.isPublic as boolean | undefined) ?? true,
      },
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

  /** Bulk catalog action over many citation ids (only DB rows are affected;
   *  in-code seeds aren't in the table, so they're untouched). Returns the
   *  number of rows changed. */
  async bulkAction(
    ids: string[],
    action: 'delete' | 'activate' | 'deactivate' | 'makePublic' | 'makePrivate',
  ): Promise<{ affected: number }> {
    if (ids.length === 0) return { affected: 0 };
    const where = { id: { in: ids } };
    let affected = 0;
    if (action === 'delete') {
      affected = (await this.db.legalCitation.deleteMany({ where })).count;
    } else {
      const data =
        action === 'activate'
          ? { isActive: true }
          : action === 'deactivate'
            ? { isActive: false }
            : action === 'makePublic'
              ? { isPublic: true }
              : { isPublic: false };
      affected = (await this.db.legalCitation.updateMany({ where, data })).count;
    }
    this.invalidate();
    return { affected };
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
    /** Tri-state: true=only active, false=only inactive, undefined=any. */
    active?: boolean;
    /** Tri-state: true=only public, false=only private, undefined=any. */
    isPublic?: boolean;
    /** Filter to citations whose `act` matches exactly (string equality). */
    act?: string;
  } = {}): Promise<{
    items: Array<
      Citation & { isActive: boolean; isPublic: boolean; source: 'db' | 'code' }
    >;
    total: number;
    page: number;
    pageSize: number;
    /** Distinct acts present in the (q-filtered) result set — drives the
     *  admin UI's "Code" dropdown so it stays in sync with the data. */
    facets: { acts: string[] };
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

    // Distinct acts from the q-filtered set (drives the "Code" dropdown so it
    // tracks the visible data, not the entire corpus).
    const acts = Array.from(new Set(filtered.map((c) => c.act))).sort();

    // Active / public / act filters — applied after `q` so facets reflect the
    // search context but not the user's own filter picks (matches the usual
    // dropdown semantics).
    if (query.active !== undefined) {
      filtered = filtered.filter((c) => c.isActive === query.active);
    }
    if (query.isPublic !== undefined) {
      filtered = filtered.filter((c) => c.isPublic === query.isPublic);
    }
    if (query.act) {
      filtered = filtered.filter((c) => c.act === query.act);
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
    return {
      items,
      total: filtered.length,
      page,
      pageSize,
      facets: { acts },
    };
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
