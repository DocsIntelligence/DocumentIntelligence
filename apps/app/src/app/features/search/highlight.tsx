import { Fragment, useMemo } from 'react';

/**
 * Render a `ts_headline` snippet (with «hl»…«/hl» sentinels from the server)
 * as safe React nodes — highlighted spans are real elements and the rest is
 * escaped text. Never use dangerouslySetInnerHTML over user content.
 */
export function Highlighted({ text }: { text: string }) {
  const parts = useMemo(() => {
    const out: { hit: boolean; text: string }[] = [];
    const re = /«hl»([\s\S]*?)«\/hl»/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ hit: false, text: text.slice(last, m.index) });
      out.push({ hit: true, text: m[1] });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ hit: false, text: text.slice(last) });
    return out;
  }, [text]);

  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark
            key={i}
            className="rounded bg-warning/30 px-0.5 text-inherit"
          >
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Route for a search hit. */
export function hrefForHit(hit: { kind: 'document' | 'source'; refId: string }): string {
  return hit.kind === 'document'
    ? `/documents/${hit.refId}/edit`
    : `/analyze/${hit.refId}`;
}
