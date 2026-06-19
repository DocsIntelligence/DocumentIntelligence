import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Badge, Card, Input } from '@org/ui';
import {
  CRIMINAL_CODE_REFORMS,
  reformRemaps,
  type ReformRemap,
  type RepealedCode,
} from '@org/legal-reference';
import { lawUrl } from '../../../../config';

/** Effective date of the 2024 criminal-law reform (all three codes share it). */
const REFORM_EFFECTIVE_FROM = CRIMINAL_CODE_REFORMS[0]?.effectiveFrom ?? '2024-07-01';

/** yyyy-mm-dd → "1 July 2024" (locale-stable, no Intl dependency surprises). */
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  if (!y || !m || !d) return iso;
  return `${d} ${months[m - 1]} ${y}`;
}

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
  high: 'success',
  moderate: 'warning',
  low: 'error',
};

const CODES: RepealedCode[] = ['IPC', 'CrPC', 'Evidence Act'];

/**
 * Reform lookup / diff tool. Given the curated `supersedes` pointers, this
 * answers "the old code cited §X — what's the current provision?" for the
 * three 2024 codifications (IPC→BNS, CrPC→BNSS, Evidence→BSA). Pure
 * client-side over `@org/legal-reference` — no API round-trip — so it's
 * instant and works offline.
 */
export function ReformLookup() {
  const { t } = useTranslation();
  const [q, setQ] = useState('');

  const remaps = useMemo(() => reformRemaps(), []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return remaps;
    // Normalise "crpc 125" / "s.125" / "§125" → "crpc125" / "125" so a single
    // box matches both the code and the bare section number.
    const compact = needle.replace(/[^a-z0-9]/g, '');
    return remaps.filter((r) => {
      const hay = [
        r.code,
        r.repealedSection,
        r.repealedLabel,
        r.successor.actShort ?? r.successor.act,
        r.successor.section ?? '',
        r.successor.title,
        ...(r.successor.topics ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return (
        hay.includes(needle) ||
        hay.replace(/[^a-z0-9]/g, '').includes(compact)
      );
    });
  }, [q, remaps]);

  const byCode = useMemo(() => {
    const groups = new Map<RepealedCode, ReformRemap[]>();
    for (const code of CODES) groups.set(code, []);
    for (const r of filtered) groups.get(r.code)?.push(r);
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Currentness banner — the "updated for 1 Jul 2024" statement. */}
      <Card className="rounded-xl border-success/30 bg-success/5 p-5">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-success/15 text-sm text-success"
            aria-hidden
          >
            ✓
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              {t(
                'reform.currentTitle',
                'Citations are current to the 2024 criminal-law reform',
              )}
            </h3>
            <p className="mt-0.5 text-sm text-foreground/70">
              {t(
                'reform.currentBody',
                'The colonial-era codes were replaced with effect from {{date}}. The drafting engine flags repealed-code references and suggests the successor below.',
                { date: prettyDate(REFORM_EFFECTIVE_FROM) },
              )}
            </p>
            <div className="mt-3 grid gap-1.5 sm:grid-cols-3">
              {CRIMINAL_CODE_REFORMS.map((reform) => (
                <div
                  key={reform.short}
                  className="rounded-lg border border-border/60 bg-card px-3 py-2"
                >
                  <p className="text-xs font-medium text-foreground">
                    {reform.short}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-foreground/55">
                    {reform.replacedBy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Search */}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t(
          'reform.searchPlaceholder',
          'Search an old reference (e.g. 302, CrPC 125, dying declaration)…',
        )}
        aria-label={t('reform.searchLabel', 'Search reform mappings')}
      />

      <p className="text-xs text-foreground/50">
        {t(
          'reform.count',
          '{{shown}} of {{total}} known mappings. Section numbers are curated — verify against the bare act before binding use.',
          { shown: filtered.length, total: remaps.length },
        )}
      </p>

      {/* Mapping table, grouped by repealed code */}
      {filtered.length === 0 ? (
        <Card className="rounded-xl p-8 text-center text-sm text-foreground/50">
          {t('reform.empty', 'No reform mapping matches “{{q}}”.', { q: q.trim() })}
        </Card>
      ) : (
        <div className="space-y-5">
          {CODES.map((code) => {
            const rows = byCode.get(code) ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={code} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
                  {code} → {rows[0].successor.actShort}
                </h4>
                <Card className="divide-y divide-border/50 overflow-hidden rounded-xl p-0">
                  {rows.map((r) => (
                    <RemapRow key={r.repealedId} remap={r} />
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RemapRow({ remap }: { remap: ReformRemap }) {
  const { successor } = remap;
  const successorLabel = `${successor.actShort ?? successor.act}${
    successor.section ? ` §${successor.section}` : ''
  }`;
  return (
    <a
      href={lawUrl(successor.id)}
      target="_blank"
      rel="noreferrer"
      className="flex items-start gap-3 px-4 py-3 transition hover:bg-secondary/40"
    >
      {/* Old → New */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="flex-none font-mono text-xs text-foreground/55 line-through decoration-foreground/30">
          {remap.repealedLabel}
        </span>
        <span className="flex-none text-foreground/35" aria-hidden>
          →
        </span>
        <span className="min-w-0">
          <span className="text-sm font-medium text-foreground">
            {successorLabel}
          </span>
          <span className="ml-2 text-xs text-foreground/55">
            {successor.title}
          </span>
        </span>
      </div>
      <Badge
        variant={CONFIDENCE_VARIANT[successor.confidence] ?? 'warning'}
        outline
        className="mt-0.5 flex-none text-[10px]"
      >
        {successor.confidence}
      </Badge>
    </a>
  );
}

/**
 * Compact "current to the 2024 reform" badge for drafting surfaces (the
 * citation panel). Links to the full reform-lookup tool. Self-contained — no
 * props, reads the effective date from the shared reform table.
 */
export function ReformBadge({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/config/legal-reference/reform"
      title={t(
        'reform.badgeTitle',
        'Citation library reflects the 2024 BNS/BNSS/BSA reform. Click for the old→new lookup.',
      )}
      className={`inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success transition hover:bg-success/20 ${className ?? ''}`}
    >
      <span aria-hidden>✓</span>
      {t('reform.badge', 'Current to 1 Jul 2024')}
    </Link>
  );
}

export default ReformLookup;
