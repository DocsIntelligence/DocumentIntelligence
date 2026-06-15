import { Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { LegalReferenceService } from './legal-reference.service';
import type { Citation } from '@org/legal-reference';

const SYSTEM = `You are a senior Indian advocate selecting statutory references for a drafter.
Given a passage of legal text + a catalog of curated citations, return STRICT JSON of the form:
  { "suggestions": [ { "id": "ni.138", "confidence": "high" | "moderate" | "low", "reason": "1 short sentence" }, ... ] }
Rules:
  • ONLY use ids from the supplied catalog. Never invent an id.
  • Order by confidence DESC, then by relevance.
  • Return at most 5 suggestions. Empty array is fine when nothing fits.
  • The "reason" must explain WHY this citation applies to THIS text — not generic "this is the cheque-bounce section".
  • Output the JSON object only — no prose, no fences.`;

export interface CitationSuggestion {
  citation: Citation;
  confidence: 'high' | 'moderate' | 'low';
  reason: string;
}

/**
 * Drafter-grade citation finder. Hands the model a passage of text + the
 * curated catalog (id + actShort/section/title/summary), gets back a ranked
 * list of citations that actually apply.
 *
 * Why an AI step instead of pure regex/keyword: the model picks up cheque +
 * payee + 15-day window patterns and knows that maps to NI §138 + §141 + §142
 * even when the passage never says "Section 138". A pure-keyword search would
 * miss the call-and-response phrasing of an actual draft.
 *
 * Bounded: the catalog is small (tens to low hundreds), the passage is capped
 * at 8 KB. Single model call, low temperature. No caching for now — drafts
 * change clause-by-clause, hash misses are common.
 */
@Injectable()
export class CitationSuggesterService {
  private readonly logger = new Logger(CitationSuggesterService.name);

  constructor(
    private readonly ai: AiService,
    private readonly refs: LegalReferenceService,
  ) {}

  async suggestForText(
    text: string,
    opts: { docTypeKey?: string; jurisdiction?: string } = {},
  ): Promise<{ suggestions: CitationSuggestion[]; model: string }> {
    const passage = (text ?? '').trim().slice(0, 8000);
    if (!passage) return { suggestions: [], model: 'n/a' };

    const catalog = await this.refs.list();
    const j = (opts.jurisdiction ?? 'IN').toUpperCase();
    // Constrain the candidate set to the right jurisdiction so the model
    // doesn't get distracted by global noise once we add UK/US adapters.
    const candidates = catalog.filter(
      (c) => (c.jurisdiction ?? 'IN').toUpperCase() === j,
    );
    if (candidates.length === 0) return { suggestions: [], model: 'n/a' };

    const catalogBlock = candidates
      .map(
        (c) =>
          `- ${c.id} :: ${c.actShort ?? c.act}${c.section ? ` §${c.section}` : ''} — ${c.title} :: ${c.summary.replace(/\s+/g, ' ').slice(0, 240)}`,
      )
      .join('\n');

    const docHint = opts.docTypeKey
      ? `\n\nDocument type: ${opts.docTypeKey}. Prefer citations whose appliesTo includes this type.`
      : '';

    const user = `CATALOG (id :: short :: summary):\n${catalogBlock}${docHint}\n\nPASSAGE:\n"""\n${passage}\n"""`;

    const resp = await this.ai.generate(user, {
      systemPrompt: SYSTEM,
      temperature: 0,
      maxTokens: 800,
    });

    const parsed = this.parseSuggestions(resp.text, candidates);
    return { suggestions: parsed, model: resp.model };
  }

  private parseSuggestions(
    raw: string,
    candidates: Citation[],
  ): CitationSuggestion[] {
    try {
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '');
      const parsed = JSON.parse(cleaned) as {
        suggestions?: Array<{ id: string; confidence?: string; reason?: string }>;
      };
      const items = parsed.suggestions ?? [];
      const byId = new Map(candidates.map((c) => [c.id, c]));
      return items
        .map((s) => {
          const c = byId.get(s.id);
          if (!c) return null;
          const conf = (s.confidence ?? 'moderate') as 'high' | 'moderate' | 'low';
          return {
            citation: c,
            confidence: ['high', 'moderate', 'low'].includes(conf)
              ? conf
              : 'moderate',
            reason: (s.reason ?? '').slice(0, 280),
          };
        })
        .filter((x): x is CitationSuggestion => x !== null)
        .slice(0, 5);
    } catch (err) {
      this.logger.warn(
        `Suggest-for-text returned non-JSON; dropping: ${(err as Error).message}`,
      );
      return [];
    }
  }
}
