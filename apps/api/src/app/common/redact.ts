/**
 * PII redaction for logs (docs/TASKS.md Tier 1). Masks the India-relevant
 * identifiers that can leak into request URLs/queries/messages — emails, phone
 * numbers, Aadhaar, PAN — so they never hit log sinks. Pure + dependency-free.
 */

const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, label: '[email]' },
  // PAN: 5 letters, 4 digits, 1 letter (before the generic digit run).
  { re: /\b[A-Z]{5}\d{4}[A-Z]\b/g, label: '[pan]' },
  // Aadhaar: 12 digits, optionally grouped 4-4-4.
  { re: /\b\d{4}\s?\d{4}\s?\d{4}\b/g, label: '[aadhaar]' },
  // Indian mobile: optional +91, then 10 digits starting 6–9.
  { re: /\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, label: '[phone]' },
];

/** Replace PII substrings in a string with type labels. */
export function redactPii(input: string): string {
  if (!input) return input;
  let out = input;
  for (const { re, label } of PATTERNS) out = out.replace(re, label);
  return out;
}

/** Scrub the PII-prone fields of a pino log object in place-ish (returns it).
 *  Targets the realistic leak points: the request URL/query and message text.
 *  Kept narrow (not a deep walk) so it's cheap on the logging hot path. */
export function scrubLogObject(obj: Record<string, unknown>): Record<string, unknown> {
  const req = obj['req'] as { url?: unknown; query?: unknown } | undefined;
  if (req) {
    if (typeof req.url === 'string') req.url = redactPii(req.url);
    if (req.query && typeof req.query === 'object') {
      const q = req.query as Record<string, unknown>;
      for (const k of Object.keys(q)) {
        if (typeof q[k] === 'string') q[k] = redactPii(q[k] as string);
      }
    }
  }
  if (typeof obj['msg'] === 'string') obj['msg'] = redactPii(obj['msg'] as string);
  const err = obj['err'] as { message?: unknown } | undefined;
  if (err && typeof err.message === 'string') err.message = redactPii(err.message);
  return obj;
}
