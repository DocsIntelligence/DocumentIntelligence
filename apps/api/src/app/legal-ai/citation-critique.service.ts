import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AiService } from '../ai/ai.service';
import { DatabaseService } from '../database/database.service';
import { LegalReferenceService } from './legal-reference.service';
import type { Citation } from '@org/legal-reference';

export interface CritiqueIssue {
  /** One of: 'missing-clause' | 'inconsistent-with-section' | 'drafting-tip'
   *  | 'limitation-window' | 'jurisdiction'. Free-form because the model is
   *  the source of authority for what category fits — we just enforce shape. */
  category: string;
  /** Citation id this issue relates to (when applicable). */
  citationId?: string;
  /** Short headline (≤ 80 chars). */
  title: string;
  /** Long-form explanation (1–3 sentences). */
  detail: string;
  /** Optional concrete text the model proposes to insert/replace. */
  proposedText?: string;
  /** 'high' | 'medium' | 'low' — analyst-grade severity. */
  severity: 'high' | 'medium' | 'low';
}

export interface CritiqueResult {
  documentId: string;
  model: string;
  groundedOn: Array<{ id: string; title: string }>;
  issues: CritiqueIssue[];
  /** True if the model found nothing material to flag. */
  ok: boolean;
  /** True when the result was served from cache (no AI call this turn). */
  cached?: boolean;
}

const SYSTEM = `You are a senior Indian advocate reviewing a draft document against the actual statutory text that governs it. You will be given:
  • A document (HTML).
  • A list of statutory sections currently cited inside it, with the bare-act-grade summary for each.

Your job: return STRICT JSON of the form { "issues": [ {category, citationId?, title, detail, proposedText?, severity}, ... ] }.

Find ONLY material issues:
  • Missing clauses that the cited section legally requires (e.g. §138 notice must demand payment within 15 days).
  • Wording in the draft that contradicts or weakens the cited section.
  • Drafting traps: limitation periods, jurisdictional clauses, statutory notice periods, proviso conditions, mandatory recitals.
  • DO NOT comment on style, length, formatting, or matters unrelated to the cited sections.

Severity rules:
  • high   — drafting error that would make the document unenforceable or attract a fatal procedural objection.
  • medium — material risk that an opponent could exploit.
  • low    — best-practice nudge.

Output ONLY the JSON object — no prose, no code fences. Return an empty issues[] array if the draft is clean.`;

/**
 * Section-grounded AI critique of a draft. Loads the present citations'
 * summaries (and fullText if populated by an admin via the indiacode sync)
 * and asks the model to find missing/contradicting clauses against THIS
 * exact statutory context — not the model's training-time guess at what
 * the law says.
 *
 * Runs on demand from the builder pane (one button click). Output is
 * shaped for direct rendering — no extra grouping logic in the UI.
 */
@Injectable()
export class CitationCritiqueService {
  private readonly logger = new Logger(CitationCritiqueService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ai: AiService,
    private readonly refs: LegalReferenceService,
  ) {}

  async critiqueDocument(
    userId: string,
    documentId: string,
    opts: { force?: boolean } = {},
  ): Promise<CritiqueResult> {
    const doc = await this.db.document.findUnique({
      where: { id: documentId },
      include: { documentType: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerUserId && doc.ownerUserId !== userId) {
      throw new ForbiddenException('Not your document');
    }
    const data = (doc.data ?? {}) as Record<string, unknown>;
    const html = typeof data['html'] === 'string' ? (data['html'] as string) : this.structuredToText(data);
    const contentHash = createHash('sha256').update(html).digest('hex');

    // ── Cache hit? ───────────────────────────────────────────────────────
    if (!opts.force) {
      const cached = await this.db.citationCritique.findUnique({
        where: { documentId_contentHash: { documentId, contentHash } },
      });
      if (cached) {
        const grounded = (cached.groundedOn ?? []) as unknown as Array<{
          id: string;
          title: string;
        }>;
        const issues = (cached.issues ?? []) as unknown as CritiqueIssue[];
        return {
          documentId,
          model: cached.model,
          groundedOn: grounded,
          issues,
          ok: issues.length === 0,
          cached: true,
        };
      }
    }

    // Pull which citations are present (via the spans the filler stamps).
    const presentIds = new Set<string>();
    for (const m of html.matchAll(/data-citation-id="([^"]+)"/g)) {
      presentIds.add(m[1]);
    }
    // Also include the doc type's "applies-to" citations — if a §138 notice
    // has zero spans (e.g. it was drafted before citation-fill existed), the
    // model still needs the §138 text to find missing recitals.
    if (doc.documentType?.key) {
      const declared = await this.refs.applicableFor(doc.documentType.key);
      for (const c of declared) presentIds.add(c.id);
    }

    const grounded: Citation[] = [];
    for (const id of presentIds) {
      const c = await this.refs.get(id);
      if (c) grounded.push(c);
    }

    if (grounded.length === 0) {
      return {
        documentId,
        model: 'n/a',
        groundedOn: [],
        issues: [],
        ok: true,
      };
    }

    const context = grounded
      .slice(0, 8) // cap to keep prompt size sane
      .map(
        (c) =>
          `# ${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''} — ${c.title}\n${c.summary}${c.draftingTips ? `\n\nDrafting tips:\n${c.draftingTips}` : ''}`,
      )
      .join('\n\n---\n\n');

    const user = `STATUTORY CONTEXT (the model MUST treat this as authoritative):\n\n${context}\n\n---\n\nDRAFT DOCUMENT (HTML):\n\n${html.slice(0, 16_000)}`;

    const resp = await this.ai.generate(user, {
      systemPrompt: SYSTEM,
      temperature: 0,
      maxTokens: 2500,
    });
    const issues = this.parseIssues(resp.text);
    const groundedOn = grounded.map((c) => ({
      id: c.id,
      title: `${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''} — ${c.title}`,
    }));

    // ── Persist to cache (idempotent upsert; identical content reuses) ──
    try {
      await this.db.citationCritique.upsert({
        where: { documentId_contentHash: { documentId, contentHash } },
        create: {
          documentId,
          contentHash,
          model: resp.model,
          groundedOn: groundedOn as unknown as Prisma.InputJsonValue,
          issues: issues as unknown as Prisma.InputJsonValue,
        },
        update: {
          model: resp.model,
          groundedOn: groundedOn as unknown as Prisma.InputJsonValue,
          issues: issues as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Cache write should never break the user-facing call.
      this.logger.warn(`Critique cache write failed: ${(err as Error).message}`);
    }

    return {
      documentId,
      model: resp.model,
      groundedOn,
      issues,
      ok: issues.length === 0,
      cached: false,
    };
  }

  // ── helpers ──────────────────────────────────────────────────────────

  private parseIssues(text: string): CritiqueIssue[] {
    try {
      const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '');
      const parsed = JSON.parse(cleaned) as { issues?: CritiqueIssue[] };
      if (!parsed.issues || !Array.isArray(parsed.issues)) return [];
      return parsed.issues
        .filter((i) => i && typeof i.title === 'string' && typeof i.detail === 'string')
        .map((i) => ({
          category: i.category ?? 'drafting-tip',
          citationId: i.citationId,
          title: i.title,
          detail: i.detail,
          proposedText: i.proposedText,
          severity: (i.severity ?? 'medium') as CritiqueIssue['severity'],
        }));
    } catch (e) {
      this.logger.warn(
        `Critique AI returned non-JSON; dropping: ${(e as Error).message}`,
      );
      return [];
    }
  }

  private structuredToText(data: Record<string, unknown>): string {
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
}
