import type { VaultSearchHit, VaultSearchMatch } from '@org/api-client';
import { Badge, Card, Input, Spinner } from '@org/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/page-header';
import { useActiveProfile } from '../profile-context';
import { formatMoney, useAssetTypes, useVaultSearch } from '../queries';

/** Magnifying-glass icon for the search field. */
function SearchIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const MATCH_VARIANT: Record<VaultSearchMatch, 'secondary' | 'info' | 'success'> = {
  asset: 'secondary',
  document: 'info',
  analysis: 'success',
};

/** Split a snippet on the (case-insensitive) query and bold the matches. */
function Highlighted({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <span>{text}</span>;
  const parts: Array<{ s: string; hit: boolean }> = [];
  const lower = text.toLowerCase();
  const lq = needle.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(lq, i);
    if (idx < 0) {
      parts.push({ s: text.slice(i), hit: false });
      break;
    }
    if (idx > i) parts.push({ s: text.slice(i, idx), hit: false });
    parts.push({ s: text.slice(idx, idx + needle.length), hit: true });
    i = idx + needle.length;
  }
  return (
    <>
      {parts.map((p, k) =>
        p.hit ? (
          <mark key={k} className="rounded bg-warning/40 px-0.5 font-medium text-foreground">
            {p.s}
          </mark>
        ) : (
          <span key={k}>{p.s}</span>
        ),
      )}
    </>
  );
}

/** Vault-wide search (docs/13): one box over asset fields, attached-document
 *  text and AI analysis summaries within the active profile. Distinct from the
 *  global drafting search — this never leaves the wealth vault. */
export function EstateSearchPage() {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();
  const { maskAmounts } = useActiveProfile();

  const [input, setInput] = useState(sp.get('q') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');

  // Debounce the input, then mirror into the URL (shareable / back-button).
  useEffect(() => {
    const id = setTimeout(() => setQ(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    setSp(next, { replace: true });
  }, [q, setSp]);

  const { data, isFetching } = useVaultSearch(q);
  const { data: types } = useAssetTypes();
  const typeLabels = useMemo(
    () => new Map((types ?? []).map((tp) => [tp.key, tp.label])),
    [types],
  );

  const matchLabel: Record<VaultSearchMatch, string> = {
    asset: t('estate.matchAsset', 'Asset'),
    document: t('estate.matchDocument', 'Document'),
    analysis: t('estate.matchAnalysis', 'Analysis'),
  };

  const items = data?.items ?? [];
  const hasQuery = q.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('estate.searchTitle', 'Search the vault')}
        subtitle={t(
          'estate.searchSubtitle',
          'Find any asset by its name, institution, document contents or AI analysis.',
        )}
        backTo="/estate"
      />

      <div className="relative max-w-xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <SearchIcon />
        </span>
        <Input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t(
            'estate.searchPlaceholder',
            'Search assets, documents, analysis…',
          )}
          className="pl-9"
        />
      </div>

      {!hasQuery ? (
        <p className="text-sm text-muted-foreground">
          {t('estate.searchHint', 'Start typing to search across your vault.')}
        </p>
      ) : isFetching && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          {t('common.searching', 'Searching…')}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t('estate.searchEmpty', 'No matches for “{{q}}”.', { q })}
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t('estate.searchCount', '{{n}} result(s)', { n: data?.total ?? items.length })}
          </p>
          <ul className="space-y-2">
            {items.map((hit: VaultSearchHit) => (
              <li key={hit.assetId}>
                <Link
                  to={`/estate/assets/${hit.assetId}`}
                  className="block rounded-lg border border-border bg-card p-4 transition hover:border-foreground/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {typeLabels.get(hit.type) ?? hit.type}
                    </Badge>
                    <span className="font-medium">{hit.label}</span>
                    {hit.institution && (
                      <span className="text-sm text-foreground/60">
                        · {hit.institution}
                      </span>
                    )}
                    <span className="ml-auto text-sm tabular-nums text-foreground/70">
                      {hit.value != null
                        ? formatMoney(hit.value, hit.currency, maskAmounts)
                        : '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-start gap-2">
                    <Badge variant={MATCH_VARIANT[hit.matchedIn]}>
                      {matchLabel[hit.matchedIn]}
                    </Badge>
                    <p className="text-sm text-foreground/70">
                      <Highlighted text={hit.snippet} q={q} />
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
