/**
 * Citation safety-net: scan generated text for references to the repealed
 * colonial-era criminal codes (IPC / CrPC / Indian Evidence Act) and flag
 * them, suggesting the 2024 successor (BNS / BNSS / BSA) — and, where the
 * curated library knows the exact remap, the successor section.
 *
 * The model is *instructed* not to emit statute numbers (it uses
 * `{{applicable_law}}`); this validates the output so a slip is caught and
 * surfaced to the user rather than trusted silently.
 */

import { CITATIONS, formatCitation } from './citations';

export interface CitationFinding {
  /** The exact text that matched. */
  matched: string;
  /** Which repealed code was referenced. */
  code: 'IPC' | 'CrPC' | 'Evidence Act';
  /** Section number, if one was attached to the reference. */
  section?: string;
  severity: 'warning';
  message: string;
  /** Suggested successor citation, when the curated library knows the remap. */
  suggestion?: string;
}

// Reverse map: repealed citation id (e.g. "ipc.302") → successor display string.
const SUPERSEDED_TO_SUCCESSOR = new Map<string, string>();
for (const c of CITATIONS) {
  if (c.supersedes) SUPERSEDED_TO_SUCCESSOR.set(c.supersedes, formatCitation(c));
}

interface CodeSpec {
  code: CitationFinding['code'];
  prefix: 'ipc' | 'crpc' | 'evidence';
  replacedBy: string;
  /** Alternation matching the act name/abbreviation. */
  act: string;
}

const CODES: CodeSpec[] = [
  {
    code: 'IPC',
    prefix: 'ipc',
    replacedBy: 'Bharatiya Nyaya Sanhita (BNS), 2023',
    act: 'IPC|I\\.P\\.C\\.?|Indian Penal Code',
  },
  {
    code: 'CrPC',
    prefix: 'crpc',
    replacedBy: 'Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023',
    act: 'CrPC|Cr\\.?\\s?P\\.?\\s?C\\.?|Code of Criminal Procedure',
  },
  {
    code: 'Evidence Act',
    prefix: 'evidence',
    replacedBy: 'Bharatiya Sakshya Adhiniyam (BSA), 2023',
    act: 'Indian Evidence Act|Evidence Act,?\\s*1872',
  },
];

const SEC = '(?:(?:section|sec\\.?|s\\.?|u/s\\.?|§)\\s*)?(\\d{1,4}[A-Z]?)';

export function validateCitations(text: string): CitationFinding[] {
  if (!text) return [];
  const findings: CitationFinding[] = [];
  const seen = new Set<string>();

  const push = (f: CitationFinding) => {
    const key = `${f.code}|${f.section ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(f);
  };

  for (const spec of CODES) {
    const numBefore = new RegExp(
      `${SEC}\\s*(?:of\\s+(?:the\\s+)?)?(?:${spec.act})`,
      'gi',
    );
    const numAfter = new RegExp(
      `(?:${spec.act})\\s*${SEC}`,
      'gi',
    );

    const withSection = (m: RegExpExecArray) => {
      const section = m[1];
      const successor = SUPERSEDED_TO_SUCCESSOR.get(`${spec.prefix}.${section}`);
      push({
        matched: m[0].trim(),
        code: spec.code,
        section,
        severity: 'warning',
        message: `References ${spec.code} §${section}, a repealed code. ${spec.code} was replaced by the ${spec.replacedBy} (eff. 2024-07-01).`,
        suggestion: successor
          ? `Likely successor: ${successor} (verify against the bare act).`
          : undefined,
      });
    };

    let m: RegExpExecArray | null;
    while ((m = numBefore.exec(text)) !== null) withSection(m);
    while ((m = numAfter.exec(text)) !== null) withSection(m);

    // Bare act mention with no section — flag once if nothing else caught it.
    const bare = new RegExp(`\\b(?:${spec.act})\\b`, 'i');
    if (bare.test(text) && !findings.some((f) => f.code === spec.code)) {
      push({
        matched: spec.code,
        code: spec.code,
        severity: 'warning',
        message: `Mentions the ${spec.code}, a repealed code, as if current. It was replaced by the ${spec.replacedBy} (eff. 2024-07-01).`,
      });
    }
  }

  return findings;
}

/** Human-readable one-liners for surfacing in toasts / the UI. */
export function citationWarnings(text: string): string[] {
  return validateCitations(text).map((f) =>
    f.suggestion ? `${f.message} ${f.suggestion}` : f.message,
  );
}
