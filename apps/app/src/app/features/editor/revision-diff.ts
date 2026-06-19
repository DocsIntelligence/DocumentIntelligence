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

// ─── Block-level HTML diff (per-change accept/reject) ──────────────────────
//
// The inline word diff above is for *display*. To let a user accept some AI
// changes and reject others, we diff at the HTML *block* level (paragraphs,
// headings, list items…) so each accepted/rejected hunk reconstructs into valid
// HTML — you can't safely splice a word back into a tag stream.

export interface BlockDiffHunk {
  id: number;
  /** `equal` = unchanged context; `change` = removed `before` → added `after`
   *  (either side may be empty for a pure insertion / deletion). */
  type: 'equal' | 'change';
  before: string[]; // HTML blocks present in the current document
  after: string[]; // HTML blocks the AI proposes
}

/** Split an HTML string into top-level block elements. Uses DOMParser in the
 *  browser; falls back to a tag-boundary regex elsewhere (SSR/tests). */
function splitBlocks(html: string): string[] {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const out: string[] = [];
    doc.body.childNodes.forEach((node) => {
      if (node.nodeType === 1) {
        out.push((node as Element).outerHTML);
      } else if (node.nodeType === 3 && node.textContent?.trim()) {
        out.push(`<p>${node.textContent.trim()}</p>`);
      }
    });
    return out.length ? out : html.trim() ? [html] : [];
  }
  return html
    .split(/(?<=<\/(?:p|h[1-6]|li|ul|ol|blockquote|pre|table|div)>)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Normalise a block for equality testing — strip tags + collapse whitespace. */
function normBlock(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Diff two HTML documents at the block level into a list of hunks. Equal hunks
 * carry shared context; change hunks carry the removed (`before`) and added
 * (`after`) blocks so the UI can offer a per-hunk accept/reject toggle and
 * `reconstructHtml` can rebuild the chosen document.
 */
export function diffHtmlBlocks(
  beforeHtml: string,
  afterHtml: string,
): BlockDiffHunk[] {
  const a = splitBlocks(beforeHtml);
  const b = splitBlocks(afterHtml);
  const na = a.map(normBlock);
  const nb = b.map(normBlock);
  const n = a.length;
  const m = b.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        na[i] === nb[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  type Op = { k: 'equal' | 'removed' | 'added'; html: string };
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (na[i] === nb[j]) {
      ops.push({ k: 'equal', html: b[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ k: 'removed', html: a[i] });
      i++;
    } else {
      ops.push({ k: 'added', html: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ k: 'removed', html: a[i++] });
  while (j < m) ops.push({ k: 'added', html: b[j++] });

  // Coalesce consecutive ops of the same class into hunks.
  const hunks: BlockDiffHunk[] = [];
  let id = 0;
  let k = 0;
  while (k < ops.length) {
    if (ops[k].k === 'equal') {
      const blocks: string[] = [];
      while (k < ops.length && ops[k].k === 'equal') blocks.push(ops[k++].html);
      hunks.push({ id: id++, type: 'equal', before: blocks, after: blocks });
    } else {
      const before: string[] = [];
      const after: string[] = [];
      while (k < ops.length && ops[k].k !== 'equal') {
        if (ops[k].k === 'removed') before.push(ops[k].html);
        else after.push(ops[k].html);
        k++;
      }
      hunks.push({ id: id++, type: 'change', before, after });
    }
  }
  return hunks;
}

/**
 * Rebuild the document HTML from hunks + the user's per-hunk decisions.
 * `accepted[id] === false` keeps the original (`before`) blocks; anything else
 * (including unset) takes the AI's proposed (`after`) blocks — i.e. changes are
 * accepted by default.
 */
export function reconstructHtml(
  hunks: BlockDiffHunk[],
  accepted: Record<number, boolean>,
): string {
  const parts: string[] = [];
  for (const h of hunks) {
    if (h.type === 'equal') parts.push(...h.after);
    else parts.push(...(accepted[h.id] === false ? h.before : h.after));
  }
  return parts.join('\n');
}
