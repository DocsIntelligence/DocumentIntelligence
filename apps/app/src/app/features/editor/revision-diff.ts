/**
 * Lightweight text diff for the AI-revision review panel. Aligns the
 * before/after plain text with a longest-common-subsequence pass and returns
 * coalesced inline segments the diff modal renders (added = green, removed =
 * red strikethrough). It diffs the *text* the AI changed, not HTML structure.
 *
 * Word granularity catches small edits inline ("1 month" → "2 months"); for
 * very large documents it falls back to block (line) granularity to bound the
 * O(n·m) DP.
 */

export type DiffOp = 'equal' | 'added' | 'removed';

export interface DiffSegment {
  op: DiffOp;
  text: string;
}

/** Word mode keeps whitespace runs as their own tokens so spacing survives. */
function tokenize(text: string, mode: 'word' | 'block'): string[] {
  if (mode === 'block') return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  return text.match(/\s+|\S+/g) ?? [];
}

/** Classic LCS backtrack over two token arrays → coalesced diff segments. */
function diffTokens(a: string[], b: string[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i:] and b[j:].
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const segs: DiffSegment[] = [];
  const push = (op: DiffOp, text: string) => {
    const last = segs[segs.length - 1];
    if (last && last.op === op) last.text += text;
    else segs.push({ op, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('equal', a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('removed', a[i]);
      i++;
    } else {
      push('added', b[j]);
      j++;
    }
  }
  while (i < n) push('removed', a[i++]);
  while (j < m) push('added', b[j++]);
  return segs;
}

/** Word-level diff, falling back to block-level for very large inputs. */
export function diffText(before: string, after: string): DiffSegment[] {
  const wa = tokenize(before, 'word');
  const wb = tokenize(after, 'word');
  if (wa.length * wb.length > 1_500_000) {
    return diffTokens(tokenize(before, 'block'), tokenize(after, 'block'));
  }
  return diffTokens(wa, wb);
}

/** True when the two texts are identical after normalising whitespace. */
export function isUnchanged(before: string, after: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  return norm(before) === norm(after);
}
