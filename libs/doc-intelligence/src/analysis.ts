/**
 * Phase 2 analysis (docs/05 §7): structured understanding of a document —
 * summary, parties, key dates, obligations, risk flags. Pure schema + prompt
 * builders; the AI call lives in the API. The model NEVER asserts statute
 * citations (golden rule) — cited-law health is a separate deterministic step
 * via `@org/legal-reference`.
 */

export interface AnalysisParty {
  name: string;
  role?: string;
}
export interface AnalysisDate {
  label: string;
  date?: string;
}
export interface AnalysisObligation {
  party?: string;
  obligation: string;
}
export interface AnalysisRiskFlag {
  severity: 'low' | 'medium' | 'high';
  note: string;
}

export interface AnalysisData {
  summary: string;
  parties?: AnalysisParty[];
  keyDates?: AnalysisDate[];
  obligations?: AnalysisObligation[];
  riskFlags?: AnalysisRiskFlag[];
}

const ANALYSIS_SYSTEM = [
  'You analyze Indian legal documents for a lawyer reviewing a case file.',
  'Produce a concise, accurate structured analysis: a plain-language summary, the parties and their roles, key dates, each party’s obligations, and any risk flags (ambiguity, missing terms, one-sided clauses, deadlines).',
  'Rules:',
  '- Base everything ONLY on the document; do not invent facts.',
  '- NEVER assert statute or section numbers — citation verification is handled separately and deterministically.',
  '- Preserve names/dates verbatim (source script + format).',
  '- Return data strictly via the provided tool/schema.',
].join('\n');

export function buildAnalysisPrompt(): { system: string; instruction: string } {
  return {
    system: ANALYSIS_SYSTEM,
    instruction:
      'Analyze this document and return the structured analysis (summary, parties, key dates, obligations, risk flags).',
  };
}

export function buildAnalysisSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'A concise plain-language summary of the document.',
      },
      parties: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            role: { type: 'string' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
      keyDates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            date: { type: 'string' },
          },
          required: ['label'],
          additionalProperties: false,
        },
      },
      obligations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            party: { type: 'string' },
            obligation: { type: 'string' },
          },
          required: ['obligation'],
          additionalProperties: false,
        },
      },
      riskFlags: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            note: { type: 'string' },
          },
          required: ['severity', 'note'],
          additionalProperties: false,
        },
      },
    },
    required: ['summary'],
    additionalProperties: false,
  };
}
