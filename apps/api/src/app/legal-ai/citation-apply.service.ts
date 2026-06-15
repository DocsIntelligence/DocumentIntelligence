import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { LegalReferenceService } from './legal-reference.service';
import {
  CitationAnalyzerService,
  type CitationAnalysis,
} from './citation-analyzer.service';
import type { Citation } from '@org/legal-reference';

export type ApplyFixAction =
  | {
      kind: 'replace-stale';
      /** The stale code matched in the doc (e.g. "Section 200 of the CrPC"). */
      matched: string;
      /** Successor citation id to insert in its place. */
      successorId: string;
    }
  | {
      kind: 'insert-missing';
      /** Citation id to insert into the doc. */
      citationId: string;
    }
  | {
      kind: 'apply-suggestion';
      /** Free-form HTML/text from the AI critique's `proposedText`. */
      proposedText: string;
      /** Optional citation id to tag the inserted paragraph with (data-citation-id). */
      citationId?: string;
      /** Optional: replace this exact substring rather than appending.
       *  When unset, append at the end as a `<p data-critique-applied>`. */
      replaceMatch?: string;
    };

export interface ApplyFixResult {
  ok: true;
  /** Updated document html (so the editor can hot-swap without reloading). */
  html: string;
  /** Refreshed citation analysis after the mutation. */
  analysis: CitationAnalysis;
  /** Human-readable description of what we just did. */
  appliedDescription: string;
}

/**
 * One-click fixes from the builder's "Legal references" panel.
 *
 *   1. **replace-stale**  — the analyzer surfaced "Section 200 of the CrPC".
 *      Rewrite that exact fragment with the successor citation span
 *      (BNSS §223). Idempotent: re-running on already-fixed text is a no-op
 *      (the regex won't match).
 *
 *   2. **insert-missing** — the analyzer flagged a citation as expected for
 *      this doc type (via `appliesTo`) but absent. Inject a short templated
 *      sentence at the end of the document referencing the citation, so
 *      the human can move/edit it as needed. We DO NOT silently rewrite
 *      clause structure — only append a stub.
 *
 * Why mutation lives here (not in `DocumentsService.patch` directly):
 *   - The citation-aware logic (which span to write, which sentence template
 *     to inject) is legal-AI concern, not generic doc CRUD.
 *   - This service writes through to `Document.data.html` directly via the
 *     same access checks the documents service uses, so the search indexer
 *     re-runs and the citation analyzer rerun reflects the new state.
 *
 * Caveat: only operates on freeform-shaped documents that carry an
 * `html` string at `data.html`. Structured bundles never have placeholder-
 * filled prose — the citations live inside narrative fields whose schema is
 * bundle-specific. For those, return a clear error instead of corrupting
 * the structured data.
 */
@Injectable()
export class CitationApplyService {

  constructor(
    private readonly db: DatabaseService,
    private readonly refs: LegalReferenceService,
    private readonly analyzer: CitationAnalyzerService,
    private readonly config: ConfigService,
  ) {}

  private get lawHost(): string {
    return (
      this.config.get<string>('PUBLIC_APP_URL') ??
      this.config.get<string>('APP_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  async apply(
    userId: string,
    documentId: string,
    action: ApplyFixAction,
  ): Promise<ApplyFixResult> {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      include: { documentType: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerUserId && doc.ownerUserId !== userId) {
      throw new ForbiddenException('Not your document');
    }
    if (doc.lockedAt) {
      throw new ForbiddenException(
        'Document is locked (signed). Create a new draft to amend.',
      );
    }
    const data = (doc.data ?? {}) as Record<string, unknown>;
    const isFreeform = typeof data['html'] === 'string';

    // Pre-resolve the citation referenced by the action so both the freeform
    // and the structured path can hand the same `Citation` to their renderers.
    const resolved = await this.resolveActionCitation(action);

    let nextData: Record<string, unknown>;
    let renderedHtml: string;
    let appliedDescription: string;

    if (isFreeform) {
      const html = data['html'] as string;
      const result = this.applyToHtml(html, action, resolved);
      nextData = { ...data, html: result.html };
      renderedHtml = result.html;
      appliedDescription = result.description;
    } else {
      // Structured doc: walk `data`, mutate narrative string fields directly.
      const result = this.applyToStructured(data, action, resolved);
      nextData = result.data;
      // For structured docs the analyzer reads a serialised text blob; synth
      // one so the refreshed analysis the UI gets is consistent.
      renderedHtml = this.serialiseStructured(nextData);
      appliedDescription = result.description;
    }

    await this.db.document.update({
      where: { id: documentId },
      data: { data: nextData as Prisma.InputJsonValue },
    });

    const analysis = await this.analyzer.analyzeText(
      renderedHtml,
      doc.documentType?.key,
    );
    return { ok: true, html: renderedHtml, analysis, appliedDescription };
  }

  /** Resolves the citation referenced by an action (or returns `null` for
   *  `apply-suggestion`, which carries free-form text). Throws a 400 when an
   *  id lookup misses, so the path-specific handlers can assume the lookup
   *  already succeeded and never need a non-null assertion. */
  private async resolveActionCitation(
    action: ApplyFixAction,
  ): Promise<Citation | null> {
    if (action.kind === 'replace-stale') {
      const c = await this.refs.get(action.successorId);
      if (!c) {
        throw new BadRequestException(
          `Unknown successor citation: ${action.successorId}`,
        );
      }
      return c;
    }
    if (action.kind === 'insert-missing') {
      const c = await this.refs.get(action.citationId);
      if (!c) {
        throw new BadRequestException(`Unknown citation: ${action.citationId}`);
      }
      return c;
    }
    return null;
  }

  // ── Freeform path (HTML in data.html) ──────────────────────────────────
  private applyToHtml(
    html: string,
    action: ApplyFixAction,
    resolved: Citation | null,
  ): { html: string; description: string } {
    if (action.kind === 'replace-stale') {
      const successor = resolved as Citation;
      const next = this.replaceFragment(html, action.matched, successor);
      if (next === html) {
        throw new BadRequestException(
          `Could not locate "${action.matched}" in the document — it may already have been fixed.`,
        );
      }
      return {
        html: next,
        description: `Replaced "${action.matched}" with ${successor.actShort ?? successor.act} §${successor.section ?? ''} link.`,
      };
    }
    if (action.kind === 'insert-missing') {
      const citation = resolved as Citation;
      if (html.includes(`data-citation-id="${citation.id}"`)) {
        throw new BadRequestException(
          'This citation is already present in the document.',
        );
      }
      return {
        html: this.appendCitationParagraph(html, citation),
        description: `Inserted reference to ${citation.actShort ?? citation.act}${citation.section ? ` §${citation.section}` : ''}.`,
      };
    }
    // apply-suggestion
    const proposed = (action.proposedText ?? '').trim();
    if (!proposed) throw new BadRequestException('proposedText is required');
    const safe = this.sanitiseProposed(proposed);
    const tag = action.citationId
      ? ` data-citation-id="${action.citationId}"`
      : '';
    const block = safe.startsWith('<')
      ? safe
      : `<p data-critique-applied="1"${tag}>${this.escapeText(safe)}</p>`;
    if (action.replaceMatch) {
      const next = this.replaceLiteral(html, action.replaceMatch, block);
      if (next === html) {
        throw new BadRequestException(
          `Could not locate "${action.replaceMatch}" in the document.`,
        );
      }
      return { html: next, description: `Replaced matched clause with critique suggestion.` };
    }
    const tailRe = /(<\/(?:body|article|main|section)>\s*)$/i;
    const next = tailRe.test(html)
      ? html.replace(tailRe, `${block}$1`)
      : html + block;
    return { html: next, description: `Inserted critique suggestion.` };
  }

  // ── Structured-doc path — walk data tree, mutate narrative strings ─────
  private applyToStructured(
    data: Record<string, unknown>,
    action: ApplyFixAction,
    resolved: Citation | null,
  ): { data: Record<string, unknown>; description: string } {
    const cloned = structuredClone(data) as Record<string, unknown>;

    if (action.kind === 'replace-stale') {
      const successor = resolved as Citation;
      // Inline citation as plain text — narrative fields in structured
      // bundles are usually strings, not HTML; a clickable span would render
      // verbatim. Use the formatted reference instead.
      const replacement = `${successor.actShort ?? successor.act}${successor.section ? ` §${successor.section}` : ''}`;
      const ok = this.mutateNarrativeFields(cloned, (s) => {
        if (!s.toLowerCase().includes(action.matched.toLowerCase())) return s;
        const re = new RegExp(
          action.matched.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i',
        );
        return s.replace(re, replacement);
      });
      if (!ok) {
        throw new BadRequestException(
          `Could not locate "${action.matched}" in any narrative field — it may already have been fixed, or lives outside the editable fields.`,
        );
      }
      return {
        data: cloned,
        description: `Replaced "${action.matched}" with ${replacement} in the appropriate field.`,
      };
    }

    if (
      action.kind === 'insert-missing' ||
      action.kind === 'apply-suggestion'
    ) {
      const text =
        action.kind === 'insert-missing'
          ? (() => {
              const c = resolved as Citation;
              return `See also: ${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''} — ${c.title}.`;
            })()
          : this.stripHtml(this.sanitiseProposed(action.proposedText ?? '')).trim();

      if (!text) throw new BadRequestException('Nothing to insert.');

      const target = this.pickNarrativeTarget(cloned);
      if (!target) {
        throw new BadRequestException(
          'No narrative text field found in this structured document — open the form and add the citation manually to the relevant section.',
        );
      }
      this.setAtPath(cloned, target.path, `${target.value}\n\n${text}`.trim());

      const label =
        action.kind === 'insert-missing'
          ? (() => {
              const c = resolved as Citation;
              return `${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''}`;
            })()
          : 'critique suggestion';
      return {
        data: cloned,
        description: `Appended ${label} to "${target.path.join('.')}".`,
      };
    }

    throw new BadRequestException('Unknown action');
  }

  /** Walk every string leaf and apply `mutate(value)`. Returns true if any
   *  field actually changed. */
  private mutateNarrativeFields(
    obj: unknown,
    mutate: (s: string) => string,
  ): boolean {
    let changed = false;
    const walk = (node: unknown, parent: Record<string, unknown> | unknown[] | null, key: string | number | null) => {
      if (typeof node === 'string') {
        const next = mutate(node);
        if (next !== node) {
          if (parent !== null && key !== null) {
            (parent as Record<string | number, unknown>)[key] = next;
            changed = true;
          }
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, node, i));
        return;
      }
      if (node && typeof node === 'object') {
        for (const k of Object.keys(node as Record<string, unknown>)) {
          walk((node as Record<string, unknown>)[k], node as Record<string, unknown>, k);
        }
      }
    };
    walk(obj, null, null);
    return changed;
  }

  /** Pick the most-narrative-looking string field to append into. Heuristic:
   *  prefer keys that look like prose containers (body / notice / recital /
   *  text / clause / narrative / content), then fall back to the longest
   *  string in the tree. Returns the path + current value so the caller can
   *  set + report what was modified. */
  private pickNarrativeTarget(
    data: Record<string, unknown>,
  ): { path: string[]; value: string } | null {
    const candidates: Array<{ path: string[]; value: string; score: number }> = [];
    const NARRATIVE_KEYS = /(body|notice|recital|text|clause|narrative|content|background|prayer|grounds|reasons)/i;
    const walk = (node: unknown, path: string[]) => {
      if (typeof node === 'string' && node.trim()) {
        const lastKey = path[path.length - 1] ?? '';
        const lengthScore = Math.min(node.length, 5000) / 1000;
        const keyScore = NARRATIVE_KEYS.test(lastKey) ? 5 : 0;
        candidates.push({ path, value: node, score: lengthScore + keyScore });
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, [...path, String(i)]));
        return;
      }
      if (node && typeof node === 'object') {
        for (const k of Object.keys(node as Record<string, unknown>)) {
          walk((node as Record<string, unknown>)[k], [...path, k]);
        }
      }
    };
    walk(data, []);
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return { path: candidates[0].path, value: candidates[0].value };
  }

  /** Write a value at a dotted/array path in a cloned data tree. */
  private setAtPath(
    obj: Record<string, unknown>,
    path: Array<string | number>,
    value: unknown,
  ): void {
    let cur: Record<string | number, unknown> = obj as Record<string | number, unknown>;
    for (let i = 0; i < path.length - 1; i++) {
      cur = cur[path[i]] as Record<string | number, unknown>;
    }
    cur[path[path.length - 1]] = value;
  }

  /** Flatten the structured data into a text blob for the analyzer pass. */
  private serialiseStructured(data: Record<string, unknown>): string {
    const parts: string[] = [];
    const walk = (v: unknown) => {
      if (v == null) return;
      if (typeof v === 'string') parts.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'object') Object.values(v as object).forEach(walk);
    };
    walk(data);
    return parts.join('\n');
  }

  // ── helpers ──────────────────────────────────────────────────────────

  /** Replace the first regex-safe occurrence of `matched` with a span for
   *  `successor`. Falls back to a literal find if regex matching is empty
   *  (e.g. the matched fragment came back with weird whitespace). */
  private replaceFragment(
    html: string,
    matched: string,
    successor: Citation,
  ): string {
    const span = this.renderCitationSpan(successor);
    // Escape regex metas + collapse whitespace differences.
    const escaped = matched
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    const re = new RegExp(escaped, 'i');
    if (re.test(html)) return html.replace(re, span);
    // Literal fallback.
    const idx = html.toLowerCase().indexOf(matched.toLowerCase());
    if (idx === -1) return html;
    return html.slice(0, idx) + span + html.slice(idx + matched.length);
  }

  /** Append a short sentence referencing the citation at the end of the
   *  document body. Picked to be unobtrusive — the human can move it. */
  private appendCitationParagraph(html: string, c: Citation): string {
    const span = this.renderCitationSpan(c);
    const sentence = `<p data-citation-suggested="${c.id}"><em>See also:</em> ${span} — ${this.escapeText(c.title)}.</p>`;
    // Insert before a closing wrapper tag if we can spot one; else append.
    const tailRe = /(<\/(?:body|article|main|section)>\s*)$/i;
    if (tailRe.test(html)) return html.replace(tailRe, `${sentence}$1`);
    return html + sentence;
  }

  /** Identical to the filler's span renderer — kept here to avoid making the
   *  filler service's escape helpers public. Source of truth for the
   *  citation-ref markup is documented in CitationFillerService. */
  private renderCitationSpan(c: Citation): string {
    const tip = this.escapeAttr(
      `${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''} — ${c.title}`,
    );
    const slug = c.id.replace(/\./g, '-');
    const href = this.lawHost ? `${this.lawHost}/law/${slug}` : `/law/${slug}`;
    const head = c.section
      ? `Section ${this.escapeText(c.section)} of the ${this.escapeText(c.act)}`
      : this.escapeText(c.act);
    return `<a class="citation-ref" data-citation-id="${c.id}" href="${href}" title="${tip}">${head}</a>`;
  }

  /**
   * Conservative sanitiser for AI-proposed text. The AI critique returns
   * plain prose or simple HTML; we strip `<script>`, `<style>`,
   * `<iframe>`, and inline event handlers (`on*=`) before letting it touch
   * the document body.
   */
  private sanitiseProposed(s: string): string {
    return s
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  private replaceLiteral(html: string, needle: string, replacement: string): string {
    const idx = html.toLowerCase().indexOf(needle.toLowerCase());
    if (idx === -1) return html;
    return html.slice(0, idx) + replacement + html.slice(idx + needle.length);
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
