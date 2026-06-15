import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  formatCitation,
  validateCitations,
  type Citation,
  type CitationFinding,
} from '@org/legal-reference';
import { LegalReferenceService } from './legal-reference.service';

const PLACEHOLDER_RE = /\{\{applicable_law\}\}/g;

export interface FillOptions {
  /** Doc type key for context (e.g. 'legal_notice'). Drives which citations
   *  are eligible to fill placeholders. */
  docTypeKey?: string;
  /** When true, also rewrite bare references to repealed codes (IPC §X) into
   *  the curated successor span. Default true. */
  rewriteStaleCitations?: boolean;
}

export interface FillResult {
  /** Rewritten HTML / text. */
  filled: string;
  /** Citations actually inserted into the output (id + how many times). */
  insertedCitations: Array<{
    citation: Citation;
    occurrences: number;
    /** Indexes within `filled` where the span was inserted, for debugging. */
    indexes: number[];
  }>;
  /** Placeholders we could NOT confidently fill — kept as `{{applicable_law}}`
   *  so a human notices and resolves. */
  unresolvedPlaceholders: number;
  /** Validator findings (stale code refs) after rewriting. Helps the UI flag
   *  anything the rewriter couldn't auto-fix. */
  remainingWarnings: CitationFinding[];
}

/**
 * Citation-filler. Two passes over the AI-drafted HTML:
 *
 *  1. **Placeholder pass** — every `{{applicable_law}}` is replaced with the
 *     most-applicable citation for the doc type. Heuristic when multiple
 *     citations apply: take the nearest *keyword hit* in surrounding text
 *     (~80 chars window); fall back to the first applicable citation.
 *
 *  2. **Repealed-code rewrite** — bare references to IPC / CrPC / Evidence Act
 *     sections that the curated library knows a successor for (via
 *     `Citation.supersedes`) are rewritten in place into the successor span.
 *     Unmapped repealed refs are kept verbatim so they show up in the
 *     analyzer's "stale" list for human review.
 *
 * Output spans look like:
 *   <a class="citation-ref"
 *      data-citation-id="ni.138"
 *      href="/law/ni-138"
 *      title="NI Act §138 — Dishonour of cheque…">
 *     Section 138 of the Negotiable Instruments Act, 1881
 *   </a>
 *
 * The analyzer + future public `/law/:id` pages key off `data-citation-id`,
 * so the round-trip from HTML → analysis → 1-click fix is lossless.
 */
@Injectable()
export class CitationFillerService {
  private readonly logger = new Logger(CitationFillerService.name);

  constructor(
    private readonly refs: LegalReferenceService,
    private readonly config: ConfigService,
  ) {}

  /** Marketing host where `/law/:id` pages live. Spans rendered into a
   *  document must point absolutely so links survive PDF export + email
   *  forwards to non-app domains. Falls back to a relative `/law/...` only
   *  when no PUBLIC_APP_URL is set (dev / SPA preview). */
  private get lawHost(): string {
    return (
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('APP_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  async fill(text: string, opts: FillOptions = {}): Promise<FillResult> {
    if (!text) {
      return {
        filled: '',
        insertedCitations: [],
        unresolvedPlaceholders: 0,
        remainingWarnings: [],
      };
    }

    const rewriteStale = opts.rewriteStaleCitations ?? true;
    const applicable = opts.docTypeKey
      ? await this.refs.applicableFor(opts.docTypeKey)
      : [];

    // ── Pass 1: placeholders ────────────────────────────────────────────
    const inserted = new Map<string, { citation: Citation; indexes: number[] }>();
    let unresolved = 0;

    const withPlaceholders = text.replace(PLACEHOLDER_RE, (match, offset) => {
      const picked = this.pickCitationForPlaceholder(text, offset, applicable);
      if (!picked) {
        unresolved += 1;
        return match;
      }
      const span = this.renderCitationSpan(picked);
      const acc = inserted.get(picked.id);
      if (acc) {
        acc.indexes.push(offset);
      } else {
        inserted.set(picked.id, { citation: picked, indexes: [offset] });
      }
      return span;
    });

    // ── Pass 2: repealed-code → successor rewrite ───────────────────────
    let filled = withPlaceholders;
    if (rewriteStale) {
      const { rewritten, addedIds } = await this.rewriteStale(filled);
      filled = rewritten;
      for (const id of addedIds) {
        const acc = inserted.get(id);
        if (acc) acc.indexes.push(-1); // -1 = not a precise offset (replaced)
        else {
          const c = await this.refs.get(id);
          if (c) inserted.set(id, { citation: c, indexes: [-1] });
        }
      }
    }

    return {
      filled,
      insertedCitations: Array.from(inserted.values()).map((v) => ({
        citation: v.citation,
        occurrences: v.indexes.length,
        indexes: v.indexes,
      })),
      unresolvedPlaceholders: unresolved,
      remainingWarnings: validateCitations(this.stripHtml(filled)),
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private pickCitationForPlaceholder(
    text: string,
    offset: number,
    applicable: Citation[],
  ): Citation | null {
    if (applicable.length === 0) return null;
    if (applicable.length === 1) return applicable[0];

    // Look at ~80 chars around the placeholder and score each applicable
    // citation by topic-keyword hits. The strongest hit wins; tie-break by
    // explicit order in the array (admins can order by importance).
    const start = Math.max(0, offset - 80);
    const window = text.slice(start, offset + 80).toLowerCase();
    let best: Citation | null = null;
    let bestScore = -1;
    for (const c of applicable) {
      const score = this.scoreCitationFit(c, window);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best ?? applicable[0];
  }

  private scoreCitationFit(c: Citation, lcWindow: string): number {
    let score = 0;
    for (const kw of [
      c.actShort?.toLowerCase(),
      c.act.toLowerCase().split(/[,\s]+/)[0],
      ...(c.topics ?? []),
    ]) {
      if (kw && lcWindow.includes(kw)) score += 1;
    }
    if (c.section && lcWindow.includes(`§${c.section}`)) score += 2;
    if (c.section && lcWindow.includes(`section ${c.section}`)) score += 2;
    return score;
  }

  /** Walk the curated CITATIONS that declare `supersedes` and rewrite any
   *  literal "{code} §{n}" / "section {n} of the {code}" occurrences into a
   *  successor span. Only rewrites mappings the library actually knows. */
  private async rewriteStale(
    html: string,
  ): Promise<{ rewritten: string; addedIds: string[] }> {
    const all = await this.refs.list();
    const remaps = all.filter((c) => c.supersedes);
    if (remaps.length === 0) return { rewritten: html, addedIds: [] };

    const addedIds: string[] = [];
    let rewritten = html;

    for (const successor of remaps) {
      // successor.supersedes = e.g. 'crpc.200'
      const [codeKey, secNum] = (successor.supersedes ?? '').split('.');
      if (!codeKey || !secNum) continue;
      const codeAct = this.codeKeyToAct(codeKey);
      if (!codeAct) continue;

      // "section 200 of the CrPC", "CrPC §200", "Section 200 CrPC", etc.
      const patterns: RegExp[] = [
        new RegExp(
          `(?:(?:section|sec\\.?|s\\.?|u/s\\.?|§)\\s*)${secNum}\\s*(?:of\\s+(?:the\\s+)?)?(?:${codeAct.alt})\\b`,
          'gi',
        ),
        new RegExp(
          `(?:${codeAct.alt})\\s*(?:(?:section|sec\\.?|s\\.?|u/s\\.?|§)\\s*)?${secNum}\\b`,
          'gi',
        ),
      ];

      let changedHere = false;
      for (const re of patterns) {
        rewritten = rewritten.replace(re, () => {
          changedHere = true;
          return this.renderCitationSpan(successor);
        });
      }
      if (changedHere && !addedIds.includes(successor.id))
        addedIds.push(successor.id);
    }

    return { rewritten, addedIds };
  }

  private codeKeyToAct(key: string): { alt: string } | null {
    switch (key) {
      case 'ipc':
        return { alt: 'IPC|I\\.P\\.C\\.?|Indian Penal Code' };
      case 'crpc':
        return { alt: 'CrPC|Cr\\.?\\s?P\\.?\\s?C\\.?|Code of Criminal Procedure' };
      case 'evidence':
        return { alt: 'Indian Evidence Act|Evidence Act,?\\s*1872' };
      default:
        return null;
    }
  }

  /** Render an inline citation span. Kept HTML-only (no React) so the same
   *  output is valid in an exported DOCX/PDF + the Tiptap editor. */
  private renderCitationSpan(c: Citation): string {
    const tip = this.escapeAttr(formatCitation(c));
    const slug = c.id.replace(/\./g, '-');
    const href = this.lawHost ? `${this.lawHost}/law/${slug}` : `/law/${slug}`;
    const head = c.section
      ? `Section ${this.escapeText(c.section)} of the ${this.escapeText(c.act)}`
      : this.escapeText(c.act);
    return `<a class="citation-ref" data-citation-id="${c.id}" href="${href}" title="${tip}">${head}</a>`;
  }

  private escapeAttr(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeText(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private stripHtml(s: string): string {
    return s.replace(/<[^>]+>/g, '');
  }
}
