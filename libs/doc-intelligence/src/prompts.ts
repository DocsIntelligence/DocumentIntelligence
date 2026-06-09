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
  '- Never invent, infer, or "tidy up" values. If a field is absent or illegible, omit it.',
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
