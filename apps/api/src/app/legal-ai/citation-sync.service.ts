import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { LegalReferenceService } from './legal-reference.service';
import { LegalSourceRegistry } from './sources/legal-source.registry';

const SUMMARISE_SYSTEM = `You are a senior Indian advocate. Given the raw text of a single statutory section, return STRICT JSON with three fields:
  summary       — 2–3 short paragraphs explaining the section in plain English for a drafter (not a layperson).
  draftingTips  — 3–6 bullet points (markdown "- ") on common drafting pitfalls, mandatory recitals, limitation periods, jurisdictional traps.
  fullText      — the cleaned bare-act text of THIS section only (strip page numbers, copy-paste artefacts, navigation chrome).

Constraints:
  • Do NOT invent section numbers, dates, or amendments not present in the input.
  • If the input is too noisy to isolate the section, set fullText="" and explain in summary.
  • Output ONLY the JSON object — no prose, no code fences.`;

/**
 * Admin-driven sync: fetch a section's raw text from the curated source
 * (today: indiacode.nic.in for India), feed it through AiService to clean +
 * summarise, persist the result onto LegalCitation.{summary, draftingTips,
 * fullText, externalUrl}. NEVER runs on the user's hot path; only admins
 * trigger it from the citation form.
 */
@Injectable()
export class CitationSyncService {
  private readonly logger = new Logger(CitationSyncService.name);

  constructor(
    private readonly refs: LegalReferenceService,
    private readonly sources: LegalSourceRegistry,
    private readonly ai: AiService,
  ) {}

  async syncFromSource(citationId: string): Promise<{
    id: string;
    sourceUrl: string;
    bytes: number;
    summary: string;
    draftingTips: string;
    fullText: string;
  }> {
    const c = await this.refs.get(citationId);
    if (!c) throw new BadRequestException(`Unknown citation: ${citationId}`);

    const adapter = this.sources.forJurisdiction(c.jurisdiction ?? 'IN');
    if (!adapter) {
      throw new BadRequestException(
        `No statute source adapter registered for jurisdiction "${c.jurisdiction ?? 'IN'}".`,
      );
    }
    if (!c.section) {
      throw new BadRequestException(
        'Section number required to fetch from the source.',
      );
    }

    const fetched = await adapter.fetchSection(c.actShort ?? c.act, c.section);
    if (!fetched) {
      throw new BadRequestException(
        `Could not resolve "${c.actShort ?? c.act} §${c.section}" on ${adapter.name}. Paste the section text manually instead.`,
      );
    }

    // AI cleanup + summarise. Honest about the limits: noisy raw HTML from
    // a portal that occasionally serves PDFs. Worst case the AI returns an
    // empty fullText + a summary noting the failure — admin reviews and
    // pastes manually.
    const userMsg = `Section: ${c.actShort ?? c.act} §${c.section} (${c.title}).\n\nRaw extracted text:\n\n${fetched.text}`;
    const resp = await this.ai.generate(userMsg, {
      systemPrompt: SUMMARISE_SYSTEM,
      temperature: 0,
      maxTokens: 2000,
    });
    const parsed = this.parseJson(resp.text);

    const updated = await this.refs.createOrUpdate({
      id: c.id,
      summary: parsed.summary || c.summary,
      draftingTips: parsed.draftingTips ?? c.draftingTips,
      externalUrl: fetched.sourceUrl,
    });

    return {
      id: updated.id,
      sourceUrl: fetched.sourceUrl,
      bytes: fetched.text.length,
      summary: parsed.summary ?? '',
      draftingTips: parsed.draftingTips ?? '',
      fullText: parsed.fullText ?? '',
    };
  }

  private parseJson(s: string): {
    summary?: string;
    draftingTips?: string;
    fullText?: string;
  } {
    try {
      const cleaned = s
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```\s*$/i, '');
      return JSON.parse(cleaned);
    } catch {
      this.logger.warn(`AI returned non-JSON; using as summary verbatim.`);
      return { summary: s };
    }
  }
}
