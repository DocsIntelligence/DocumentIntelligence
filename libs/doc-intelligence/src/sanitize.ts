/**
 * Defense-in-depth against the model ignoring the "omit if absent" prompt
 * rule (prompts.ts) and instead writing an explanatory non-answer as if it
 * were the field's value — e.g. "Not explicitly stated in the document",
 * "N/A", "Unable to determine". A prompt instruction is not enforcement;
 * this runs on every extraction result regardless of provider/model so such
 * filler never reaches the stored record. Matches the field's semantics:
 * the field is treated as genuinely absent, i.e. omitted, not set to "".
 */

const FILLER_PATTERNS: RegExp[] = [
  // "not (explicitly) stated/mentioned/specified/indicated/provided/available/found/present (in/on) (the) document/source/text/page"
  /^(this\s+is\s+)?not\s+(explicitly\s+)?(stated|mentioned|specified|indicated|provided|available|found|present|clear|given)\b.*\b(document|source|text|page|record|extract)\b/i,
  // bare non-answers
  /^(n\/?a|none|null|unknown|not applicable|not available|not provided|not specified|not stated|not mentioned|not found|not present|no information (provided|available)|unable to (determine|find|identify)|cannot be determined|could not be determined|no data(\s+available)?)\.?$/i,
];

function isFillerString(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  return FILLER_PATTERNS.some((re) => re.test(s));
}

/**
 * Recursively strips filler-text leaves from an extracted value tree
 * (handles nested `table`/`group` fields, not just top-level strings).
 * Returns `undefined` when the whole value should be omitted.
 */
export function stripFillerValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return isFillerString(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    const cleaned = value
      .map(stripFillerValue)
      .filter((v) => v !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripFillerValue(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
  return value;
}

/** Applies {@link stripFillerValue} to every top-level field, omitting the
 *  key entirely when the cleaned value is `undefined`. */
export function stripFillerFields<T extends Record<string, unknown>>(
  fields: T,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    const cleaned = stripFillerValue(value);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out as Partial<T>;
}
