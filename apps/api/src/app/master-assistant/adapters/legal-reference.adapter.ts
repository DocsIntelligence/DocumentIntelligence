import { Injectable } from '@nestjs/common';
import type { JsonSchema } from '../../ai/providers/ai-provider.interface';
import { LegalReferenceService } from '../../legal-ai/legal-reference.service';
import {
  normalizeKey,
  type MasterAdapter,
  type MasterRecordPlan,
} from '../master-adapter';

interface AiCitationRecord {
  id: string;
  act?: string;
  actShort?: string;
  section?: string;
  title: string;
  summary?: string;
  topics?: string[];
  draftingTips?: string;
  jurisdiction?: string;
  confidence?: 'low' | 'moderate' | 'high';
}

/**
 * Master adapter for legal references (citations). Natural key = citation `id`.
 *
 * GOLDEN RULE (docs/ARCHITECTURE_PRINCIPLES + CLAUDE.md): the AI must NEVER
 * author or guess statute identity (act + section number). It may draft the
 * human-facing summary, topics and drafting tips, but `act`/`section` are only
 * accepted when the user states them explicitly. Anything AI-proposed is forced
 * to `confidence: 'low'` with a verifyNote so a human verifies the citation
 * identity before it is trusted.
 */
@Injectable()
export class LegalReferenceMasterAdapter implements MasterAdapter {
  readonly key = 'legal-reference';
  readonly label = 'Legal references';
  readonly description =
    'Draft legal-reference entries (summary, topics, drafting tips). You must supply the exact act + section — the AI never invents statute numbers.';

  readonly recordsSchema: JsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      records: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description:
                'Stable slug id, e.g. "ni-act-138" or "hma-13". Derive from the act + section the USER gave.',
            },
            act: {
              type: 'string',
              description:
                'Full act name EXACTLY as the user stated it. Do not invent.',
            },
            actShort: { type: 'string' },
            section: {
              type: 'string',
              description:
                'Section number EXACTLY as the user stated it. If the user did not give a specific section, leave empty — never guess.',
            },
            title: { type: 'string', description: 'Short human title.' },
            summary: {
              type: 'string',
              description: 'Plain-language summary of what this provision covers.',
            },
            topics: { type: 'array', items: { type: 'string' } },
            draftingTips: {
              type: 'string',
              description: 'How a drafter should use/cite this provision.',
            },
            jurisdiction: { type: 'string', description: 'e.g. "IN".' },
            confidence: { type: 'string', enum: ['low', 'moderate', 'high'] },
          },
          required: ['id', 'title'],
        },
      },
    },
    required: ['records'],
  };

  readonly systemPrompt = [
    'You author LEGAL REFERENCE entries for an India-first legal platform.',
    'CRITICAL GOLDEN RULE: you must NEVER invent, guess or "recall" a statute',
    'identity. Use the act name and section number ONLY when the user states them',
    'explicitly in the prompt. If the user does not give a precise section, leave',
    '`section` empty — do not fill it from memory.',
    'You MAY draft the summary, topics and drafting tips in plain language.',
    'Derive `id` as a stable slug from the act + section the user provided.',
    'Return only the structured records.',
  ].join('\n');

  constructor(private readonly refs: LegalReferenceService) {}

  async plan(aiData: unknown): Promise<MasterRecordPlan[]> {
    const records = (aiData as { records?: AiCitationRecord[] })?.records ?? [];
    const existing = await this.refs.list();
    const ids = new Set(existing.map((c) => normalizeKey(c.id)));

    return records.map((rec) => {
      const action = ids.has(normalizeKey(rec.id)) ? 'update' : 'create';
      const cite = [rec.actShort ?? rec.act, rec.section && `s.${rec.section}`]
        .filter(Boolean)
        .join(' ');
      return {
        ref: `legal-reference:${rec.id}`,
        label: cite ? `${rec.title} — ${cite}` : rec.title,
        action,
        note: 'confidence: low — verify section identity',
        record: rec,
      };
    });
  }

  async commit(record: unknown): Promise<void> {
    const rec = record as AiCitationRecord;
    // Force low confidence + a verify note for anything AI-proposed — the human
    // reviewer confirms the act/section identity (golden rule).
    await this.refs.createOrUpdate({
      id: rec.id,
      act: rec.act,
      actShort: rec.actShort,
      section: rec.section,
      title: rec.title,
      summary: rec.summary,
      topics: rec.topics,
      draftingTips: rec.draftingTips,
      jurisdiction: rec.jurisdiction,
      confidence: 'low',
      verifyNote: 'AI-drafted via Master Assistant — verify act/section identity.',
    });
  }
}
