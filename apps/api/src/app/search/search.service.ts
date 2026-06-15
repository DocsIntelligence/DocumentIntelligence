import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { SearchConfigService } from './search-config.service';

export type SearchSort = 'relevance' | 'recent' | 'title';

export interface SearchParams {
  q?: string;
  kind?: 'document' | 'source';
  type?: string;
  status?: string;
  sort?: SearchSort;
  page: number;
  pageSize: number;
  /**
   * Restrict to documents belonging to this DocumentGroup. Only meaningful for
   * kind='document'; when set, sources are excluded automatically (groups only
   * contain drafting documents — see Document.groupId).
   */
  groupId?: string;
}

export interface SearchHit {
  kind: 'document' | 'source';
  refId: string;
  title: string;
  /** Title with «hl»…«/hl» highlight markers (same query terms as the snippet). */
  titleSnippet: string;
  type: string | null;
  status: string | null;
  snippet: string;
  score: number;
  refUpdatedAt: Date | null;
}

export interface SearchFacets {
  document: number;
  source: number;
}

export interface SearchResponse {
  items: SearchHit[];
  total: number;
  /** Per-kind match counts for the query (ignores the active kind filter) — powers the filter chips. */
  facets: SearchFacets;
  meta: { semantic: boolean; q: string; sort: SearchSort; tookMs: number };
}

/** Semantic-only floor: a row with no keyword/fuzzy match is included on vector
 *  similarity alone only when cosine ≥ this. */
const SEMANTIC_FLOOR = 0.2;
/** Recency half-life, in days (freshness = 1 at age 0, 0.5 at this age). */
const RECENCY_HALFLIFE_DAYS = 30;

function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly config: SearchConfigService,
    private readonly ai: AiService,
  ) {}

  private async userOrgIds(userId: string): Promise<string[]> {
    const rows = await this.db.orgMember.findMany({
      where: { userId },
      select: { orgId: true },
    });
    return rows.map((r) => r.orgId);
  }

  async search(userId: string, params: SearchParams): Promise<SearchResponse> {
    const startedAt = Date.now();
    const sort: SearchSort = params.sort ?? 'relevance';
    const orgIds = await this.userOrgIds(userId);
    const cfg = await this.config.getEffective(orgIds[0] ?? null);

    const q = (params.q ?? '').trim();
    const allowedKinds = new Set(cfg.enabledKinds);
    // A groupId filter is document-only: groups only contain drafting docs.
    const requestedKinds = params.groupId
      ? ['document']
      : params.kind
        ? [params.kind]
        : ['document', 'source'];
    const kinds = requestedKinds.filter((k) => allowedKinds.has(k));
    const empty: SearchResponse = {
      items: [],
      total: 0,
      facets: { document: 0, source: 0 },
      meta: { semantic: false, q, sort, tookMs: Date.now() - startedAt },
    };
    if (kinds.length === 0) return empty;

    // Embed the query for the semantic leg (best-effort).
    let embLiteral: string | null = null;
    if (q && cfg.semanticEnabled && this.ai.canEmbed()) {
      try {
        const [vec] = await this.ai.embed([q]);
        if (vec?.length) embLiteral = toVectorLiteral(vec);
      } catch (e) {
        this.logger.warn(`query embed failed, keyword-only: ${String(e)}`);
      }
    }
    const semantic = !!embLiteral;

    // Tunables (clamped) injected as SQL literals — they're trusted numbers.
    const kwW = Math.max(0, cfg.keywordWeight);
    const semW = Math.max(0, cfg.semanticWeight);
    const denom = Math.max(kwW + semW, 0.0001);
    const recencyW = clamp01(cfg.recencyWeight);
    const fuzzyT = clamp01(cfg.fuzzyThreshold);
    const snippetWords = Math.max(10, Math.min(80, Math.round(cfg.snippetWords)));

    /**
     * Build the WHERE + scoring expressions against a fresh positional-param
     * array (so the facet query and the page query each get a self-consistent
     * `$1..$n` set). `withKind` toggles the kind filter (facets ignore it).
     */
    const build = (withKind: boolean) => {
      const ps: unknown[] = [];
      const p = (v: unknown) => {
        ps.push(v);
        return `$${ps.length}`;
      };

      const conds: string[] = [
        `(si."ownerUserId" = ${p(userId)} OR si."ownerOrgId" = ANY(${p(orgIds)}::text[]))`,
      ];
      if (withKind) conds.push(`si.kind = ANY(${p(kinds)}::text[])`);
      if (params.type) conds.push(`si.type = ${p(params.type)}`);
      if (params.status) conds.push(`si.status = ${p(params.status)}`);
      if (params.groupId) {
        // SearchIndex.refId for kind='document' is Document.id. Filter via
        // EXISTS so the planner can use the Document_groupId_idx index without
        // joining ahead of WHERE.
        conds.push(
          `si.kind = 'document' AND EXISTS (SELECT 1 FROM "Document" d WHERE d.id = si."refId" AND d."groupId" = ${p(params.groupId)})`,
        );
      }

      let scoreExpr = '0';
      let snippetExpr = `left(si."bodyText", 240)`;
      let titleExpr = 'si.title';

      if (q) {
        const qp = p(q);
        const tsq = `websearch_to_tsquery('english', ${qp})`;
        // ts_rank_cd with normalization flag 32 ⇒ rank/(rank+1) ∈ [0,1) — no
        // arbitrary scaling. Fold in a title-trgm score for typo tolerance.
        const kw = `ts_rank_cd(si.tsv, ${tsq}, 32)`;
        const fuzzy = `public.similarity(si.title, ${qp})`;
        const embTok = semantic ? p(embLiteral) : null;
        const sem = embTok
          ? `GREATEST(1 - (si.embedding <=> ${embTok}::vector), 0)`
          : '0';
        const textRel = `GREATEST(${kw}, ${fuzzy} * 0.6)`;
        const relevance = `((${kwW} * ${textRel} + ${semW} * ${sem}) / ${denom})`;
        const freshness = `(1.0 / (1.0 + (EXTRACT(EPOCH FROM (now() - COALESCE(si."refUpdatedAt", si."createdAt"))) / 86400.0) / ${RECENCY_HALFLIFE_DAYS}.0))`;
        scoreExpr = `((1 - ${recencyW}) * ${relevance} + ${recencyW} * ${freshness})`;

        snippetExpr = `ts_headline('english', si."bodyText", ${tsq}, 'MaxWords=${snippetWords},MinWords=10,MaxFragments=2,StartSel=«hl»,StopSel=«/hl»')`;
        titleExpr = `ts_headline('english', si.title, ${tsq}, 'HighlightAll=true,StartSel=«hl»,StopSel=«/hl»')`;

        const match = [`si.tsv @@ ${tsq}`, `${fuzzy} >= ${fuzzyT}`];
        if (embTok) {
          match.push(
            `(si.embedding IS NOT NULL AND 1 - (si.embedding <=> ${embTok}::vector) >= ${SEMANTIC_FLOOR})`,
          );
        }
        conds.push(`(${match.join(' OR ')})`);
      }

      return { ps, where: conds.join(' AND '), scoreExpr, snippetExpr, titleExpr };
    };

    // ── Facets (per-kind counts; kind filter excluded) ────────────────────
    const fb = build(false);
    const facetRows = await this.db.$queryRawUnsafe<
      { kind: 'document' | 'source'; n: number }[]
    >(
      `SELECT si.kind, count(*)::int AS n FROM "SearchIndex" si WHERE ${fb.where} GROUP BY si.kind`,
      ...fb.ps,
    );
    const facets: SearchFacets = { document: 0, source: 0 };
    for (const r of facetRows) facets[r.kind] = r.n;
    const total = Math.min(
      kinds.reduce((s, k) => s + (facets[k as 'document' | 'source'] ?? 0), 0),
      cfg.maxResults,
    );

    // ── Page of results ───────────────────────────────────────────────────
    const pb = build(true);
    const p2 = (v: unknown) => {
      pb.ps.push(v);
      return `$${pb.ps.length}`;
    };
    const limit = Math.min(params.pageSize, cfg.maxResults);
    const offset = Math.min(params.page * params.pageSize, cfg.maxResults);

    const orderBy =
      sort === 'recent'
        ? `si."refUpdatedAt" DESC NULLS LAST`
        : sort === 'title'
          ? `si.title ASC`
          : q
            ? `score DESC, si."refUpdatedAt" DESC NULLS LAST`
            : `si."refUpdatedAt" DESC NULLS LAST`;

    const rows = await this.db.$queryRawUnsafe<
      Array<{
        kind: 'document' | 'source';
        refId: string;
        title: string;
        titleSnippet: string;
        type: string | null;
        status: string | null;
        refUpdatedAt: Date | null;
        score: number;
        snippet: string;
      }>
    >(
      `SELECT si.kind, si."refId", si.title, si.type, si.status, si."refUpdatedAt",
              ${pb.scoreExpr} AS score,
              ${pb.snippetExpr} AS snippet,
              ${pb.titleExpr} AS "titleSnippet"
       FROM "SearchIndex" si
       WHERE ${pb.where}
       ORDER BY ${orderBy}
       LIMIT ${p2(limit)} OFFSET ${p2(offset)}`,
      ...pb.ps,
    );

    return {
      items: rows.map((r) => ({
        kind: r.kind,
        refId: r.refId,
        title: r.title,
        titleSnippet: r.titleSnippet ?? r.title,
        type: r.type,
        status: r.status,
        snippet: r.snippet ?? '',
        score: Number(r.score) || 0,
        refUpdatedAt: r.refUpdatedAt,
      })),
      total,
      facets,
      meta: { semantic, q, sort, tookMs: Date.now() - startedAt },
    };
  }
}
