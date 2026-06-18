import type { SearchKind, SearchSort } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  Chip,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/page-header';
import { useDocumentCatalog } from '../documents/queries';
import { useSearch } from './queries';
import { Highlighted, hrefForHit } from './highlight';

const ANY = '__any__';
const STATUSES = ['draft', 'in_review', 'ready', 'signed', 'archived'];
const PAGE_SIZES = [10, 20, 50, 100];

function relativeDate(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Global hybrid search across the user's drafts + uploaded documents. */
export function SearchPage() {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();

  const [input, setInput] = useState(sp.get('q') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [kind, setKind] = useState<SearchKind | null>(
    (sp.get('kind') as SearchKind) || null,
  );
  const [type, setType] = useState(sp.get('type') ?? ANY);
  const [status, setStatus] = useState(sp.get('status') ?? ANY);
  const [sort, setSort] = useState<SearchSort>(
    (sp.get('sort') as SearchSort) || 'relevance',
  );
  const [pageSize, setPageSize] = useState(Number(sp.get('ps')) || 20);
  const [page, setPage] = useState(0);

  const catalog = useDocumentCatalog();

  // Debounce the query input.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(input.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [input]);

  // Mirror state into the URL (shareable / back-button).
  useEffect(() => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (kind) next.set('kind', kind);
    if (type !== ANY) next.set('type', type);
    if (status !== ANY) next.set('status', status);
    if (sort !== 'relevance') next.set('sort', sort);
    if (pageSize !== 20) next.set('ps', String(pageSize));
    setSp(next, { replace: true });
  }, [q, kind, type, status, sort, pageSize, setSp]);

  const enabled = q.length > 0;
  const { data, isFetching, isPlaceholderData } = useSearch(
    {
      q,
      kind: kind ?? undefined,
      type: type === ANY ? undefined : type,
      status: status === ANY ? undefined : status,
      sort,
      page,
      pageSize,
    },
    enabled,
  );

  const total = data?.total ?? 0;
  const facets = data?.facets;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const items = data?.items ?? [];
  const loading = enabled && isFetching && (!data || isPlaceholderData);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  return (
    <div className="mx-auto space-y-5">
      <PageHeader
        back={false}
        title={t('search.title', 'Search')}
        subtitle={t(
          'search.subtitle',
          'Search across your drafts and uploaded documents — by title or anything inside.',
        )}
      />

      <div className="space-y-3">
        <Input
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('search.placeholder', 'Search documents…')}
          aria-label={t('search.title', 'Search')}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Chip active={!kind} onClick={() => reset(() => setKind(null))}>
            {t('search.allKinds', 'All')}
            {facets ? ` (${facets.document + facets.source})` : ''}
          </Chip>
          <Chip
            active={kind === 'document'}
            onClick={() => reset(() => setKind('document'))}
          >
            {t('search.drafts', 'Drafts')}
            {facets ? ` (${facets.document})` : ''}
          </Chip>
          <Chip
            active={kind === 'source'}
            onClick={() => reset(() => setKind('source'))}
          >
            {t('search.uploads', 'Uploads')}
            {facets ? ` (${facets.source})` : ''}
          </Chip>

          <Select value={type} onValueChange={(v) => reset(() => setType(v))}>
            <SelectTrigger className="ml-1 h-8 w-auto min-w-32 text-xs">
              <SelectValue placeholder={t('search.anyType', 'Any type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>
                {t('search.anyType', 'Any type')}
              </SelectItem>
              {(catalog.data ?? []).map((dt) => (
                <SelectItem key={dt.key} value={dt.key}>
                  {dt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => reset(() => setStatus(v))}
          >
            <SelectTrigger className="h-8 w-auto min-w-28 text-xs">
              <SelectValue placeholder={t('search.anyStatus', 'Any status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>
                {t('search.anyStatus', 'Any status')}
              </SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sort}
            onValueChange={(v) => reset(() => setSort(v as SearchSort))}
          >
            <SelectTrigger className="h-8 w-auto min-w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">
                {t('search.sortRelevance', 'Relevance')}
              </SelectItem>
              <SelectItem value="recent">
                {t('search.sortRecent', 'Most recent')}
              </SelectItem>
              <SelectItem value="title">
                {t('search.sortTitle', 'Title A–Z')}
              </SelectItem>
            </SelectContent>
          </Select>

          {isFetching && <Spinner className="ml-1 h-4 w-4" />}
          {data?.meta.semantic && (
            <Badge variant="secondary" className="ml-auto">
              {t('search.semanticOn', 'Semantic on')}
            </Badge>
          )}
        </div>
      </div>

      {!enabled ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('search.empty', 'Type to search your documents.')}
        </p>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-secondary/40"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('search.noResults', 'No matches found.')}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t(
                'search.showingRange',
                'Showing {{from}}–{{to}} of {{total}}',
                {
                  from,
                  to,
                  total,
                },
              )}
              {data?.meta.tookMs != null && (
                <span className="ml-1 opacity-70">· {data.meta.tookMs}ms</span>
              )}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => reset(() => setPageSize(Number(v)))}
            >
              <SelectTrigger className="h-7 w-auto min-w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t('search.perPage', '{{n}} / page', { n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {items.map((hit) => (
              <Link
                key={`${hit.kind}:${hit.refId}`}
                to={hrefForHit(hit)}
                className="block"
              >
                <Card className="p-3 transition-colors hover:bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        hit.kind === 'document' ? 'primary' : 'secondary'
                      }
                    >
                      {hit.kind === 'document'
                        ? t('search.draft', 'Draft')
                        : t('search.upload', 'Upload')}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      <Highlighted text={hit.titleSnippet || hit.title} />
                    </span>
                    {hit.refUpdatedAt && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {relativeDate(hit.refUpdatedAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {hit.type && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {hit.type}
                      </span>
                    )}
                    {hit.status && (
                      <Badge
                        variant="secondary"
                        outline
                        className="text-[10px]"
                      >
                        {hit.status}
                      </Badge>
                    )}
                  </div>
                  {hit.snippet && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      <Highlighted text={hit.snippet} />
                    </p>
                  )}
                </Card>
              </Link>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 text-sm">
              <PagerBtn disabled={page === 0} onClick={() => setPage(0)}>
                «
              </PagerBtn>
              <PagerBtn
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t('common.prev', 'Prev')}
              </PagerBtn>
              <span className="px-2 text-muted-foreground">
                {t('search.pageOf', 'Page {{page}} of {{count}}', {
                  page: page + 1,
                  count: pageCount,
                })}
              </span>
              <PagerBtn
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('common.next', 'Next')}
              </PagerBtn>
              <PagerBtn
                disabled={page + 1 >= pageCount}
                onClick={() => setPage(pageCount - 1)}
              >
                »
              </PagerBtn>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PagerBtn({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" size="sm" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  );
}
