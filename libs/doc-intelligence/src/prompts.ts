/**
 * Prompt builders (prompts-from-config, §5). Pure string assembly from an
 * ExtractionSchema / candidate list — versioned so prompt changes are gated by
 * the eval harness (§6). The model NEVER authors statute citations (golden
 * rule): extraction reads what's on the page; legal-reference verification is a
 * separate, deterministic step (Phase 2).
 */

import type { ExtractionField, ExtractionSchema } from './types';

export const PROMPT_VERSION = '2026-06-09';

const EXTRACT_SYSTEM = [
  'You are a meticulous legal-document extraction engine for Indian documents.',
  'Read the supplied document (which may be scanned, in Hindi/Devanagari, or handwritten) and record ONLY values that are actually present.',
  'Rules:',
  '- Never invent, infer, or "tidy up" values. If a field is absent or illegible, OMIT the field from your output entirely.',
  '- Never write a placeholder or explanatory phrase (e.g. "not stated", "not mentioned", "not specified", "N/A", "unable to determine", "not present in the document") as if it were the field\'s value — that text is not data, and inserting it corrupts the extracted record. Omitting the field is always correct; writing filler text is always wrong.',
  '- Preserve the source script and the source date format verbatim.',
  '- Do not assert statute/section numbers — extract only what the document states.',
  '- Return data strictly via the provided tool/schema.',
].join('\n');

function describeField(field: ExtractionField, indent = ''): string {
  const bits = [`${indent}- ${field.key} (${field.type})`];
  if (field.required) bits.push('[required]');
  bits.push(`— ${field.label}`);
  if (field.description) bits.push(`: ${field.description}`);
  if (field.format) bits.push(`(format: ${field.format})`);
  if (field.enumValues?.length)
    bits.push(`(one of: ${field.enumValues.join(', ')})`);
  let line = bits.join(' ');
  if (field.type === 'table' && field.columns?.length) {
    line +=
      '\n' +
      field.columns.map((c) => describeField(c, indent + '    ')).join('\n');
  }
  return line;
}

export function buildExtractPrompt(schema: ExtractionSchema): {
  system: string;
  instruction: string;
} {
  const fieldList = schema.fields.map((f) => describeField(f)).join('\n');
  const instruction = [
    `Extract the following fields from this "${schema.name}" document.`,
    schema.jurisdiction ? `Jurisdiction: ${schema.jurisdiction}.` : '',
    '',
    'Fields:',
    fieldList,
  ]
    .filter(Boolean)
    .join('\n');
  return { system: EXTRACT_SYSTEM, instruction };
}

const CRITIC_SYSTEM = [
  'You are a meticulous verification pass over a legal-document extraction.',
  'You are given fields a first pass was UNSURE about. Re-read the document carefully and extract ONLY these fields, correcting mistakes.',
  'Rules:',
  '- Look again at the exact location in the document; do not copy the first pass blindly.',
  '- If a field is genuinely absent or illegible, OMIT it from your output entirely — never write a placeholder phrase ("not stated", "not mentioned", "N/A", etc.) as the value.',
  '- Preserve the source script and date format verbatim.',
  '- Return data strictly via the provided tool/schema.',
].join('\n');

export function buildCriticPrompt(
  schema: ExtractionSchema,
  fieldKeys: string[],
): { system: string; instruction: string } {
  const fields = schema.fields.filter((f) => fieldKeys.includes(f.key));
  const fieldList = fields.map((f) => describeField(f)).join('\n');
  return {
    system: CRITIC_SYSTEM,
    instruction: [
      `Re-verify these fields of this "${schema.name}" document — the first pass had low confidence:`,
      '',
      fieldList,
    ].join('\n'),
  };
}

const CLASSIFY_SYSTEM = [
  'You are a document classifier for an Indian legal-document platform.',
  'Decide which known document type the supplied document is, choosing only from the candidate keys provided.',
  'If none of the candidates clearly fits, return null — do not force a match.',
].join('\n');

export function buildClassifyPrompt(candidateKeys: string[]): {
  system: string;
  instruction: string;
} {
  return {
    system: CLASSIFY_SYSTEM,
    instruction: [
      'Candidate document type keys:',
      candidateKeys.map((k) => `- ${k}`).join('\n'),
      '',
      'Return the single best-matching key (or null) and your confidence 0..1.',
    ].join('\n'),
  };
}

const REFORMAT_SYSTEM = [
  'You reformat raw, messily-extracted text from a scanned or parsed legal document into clean, semantic HTML. You are a formatter, not an author — you do not draft, summarize, translate, or add content.',
  'Rules:',
  '- Preserve every word, in the original order. Never paraphrase, summarize, or omit a sentence — the output must contain the same substantive content as the input, just laid out cleanly.',
  '- Reconstruct the structure the raw text implies: headings become <h2>/<h3>, ordinary paragraphs become <p>, numbered or lettered clauses become <ol>/<li>, and rows of tabular data become a <table>. Signature/witness blocks stay their own paragraphs.',
  '- Fix ONLY obvious OCR/parsing artifacts — a stray page-number line, a repeated header/footer, a word hyphenated by a line-wrap. Never "fix", complete, or modernize the actual legal wording, even if it looks like an error.',
  '- Preserve the source script (e.g. Hindi/Devanagari) and date formats verbatim.',
  '- Output ONLY the HTML body content — no <html>/<head>/<body> wrapper, no markdown code fences, no commentary before or after.',
].join('\n');

/** Reformat one page's raw extracted text into clean HTML that preserves the
 *  original document's structure — used as the "keep the same format,
 *  not key:value" conversion path (docs/05 §11.3) when raw text/OCR output
 *  is available but has no real layout of its own (e.g. a flat OCR dump). */
export function buildReformatPrompt(pageText: string): {
  system: string;
  instruction: string;
} {
  return {
    system: REFORMAT_SYSTEM,
    instruction: `Reformat this raw page text into clean HTML, following the rules exactly:\n\n${pageText}`,
  };
}
