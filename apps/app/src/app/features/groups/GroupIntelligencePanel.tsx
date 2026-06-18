import { Button, Input, Spinner } from '@org/ui';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Highlighted, hrefForHit } from '../search';
import {
  useGenerateGroupSummary,
  useGroupSearch,
  useGroupSummary,
} from './queries';

interface ViewProps {
  groupId: string;
  documentCount: number;
}

/**
 * Tab content: full-text + semantic search across the group's documents.
 * Hits link out to the matching document. Renders without an outer card so it
 * can be slotted directly into a TabsContent panel.
 */
export function GroupSearchView({ groupId, documentCount }: ViewProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const search = useGroupSearch(
    groupId,
    { q: debouncedQuery, page: 0, pageSize: 10, sort: 'relevance' },
    debouncedQuery.length > 0,
  );

  const empty = documentCount === 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {t('groups.intelSearch', 'Search within group')}
        </h3>
        {search.isFetching && debouncedQuery && (
          <Spinner size="sm" className="text-foreground/50" />
        )}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          empty
            ? t('groups.intelSearchDisabled', 'Add documents to enable search…')
            : t(
                'groups.intelSearchPlaceholder',
                'Search clauses, parties, dates, obligations…',
              )
        }
        disabled={empty}
      />
      {debouncedQuery && (
        <SearchResults
          hits={search.data?.items ?? []}
          total={search.data?.total ?? 0}
          isLoading={search.isLoading}
          isFetching={search.isFetching}
          q={debouncedQuery}
        />
      )}
      {!debouncedQuery && !empty && (
        <p className="rounded-md border border-dashed border-border bg-secondary/35 px-3 py-8 text-center text-xs text-foreground/50">
          {t(
            'groups.intelSearchHint',
            'Type to search across the documents in this group.',
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Tab content: group-level summary, built from each document's analysis run.
 * Read-only view of the stored summary plus a Generate/Regenerate CTA. The
 * model never authors document summaries here — we aggregate existing ones.
 */
export function GroupSummaryView({ groupId, documentCount }: ViewProps) {
  const { t } = useTranslation();
  const summary = useGroupSummary(groupId);
  const generate = useGenerateGroupSummary();
  const empty = documentCount === 0;
  const hasSummary = !!summary.data?.summary;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">
            {t('groups.intelSummaryTitle', 'Group summary')}
          </h3>
          <p className="text-xs text-foreground/55">
            {t(
              'groups.intelSummaryHelp',
              'Built from each document\u2019s analysis summary \u2014 analyze documents first.',
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant={hasSummary ? 'outline' : 'default'}
          disabled={empty || generate.isPending}
          onClick={() => generate.mutate(groupId)}
        >
          {generate.isPending
            ? t('common.generating', 'Generating…')
            : hasSummary
              ? t('groups.regenerate', 'Regenerate')
              : t('groups.generate', 'Generate summary')}
        </Button>
      </div>

      {generate.data?.unanalyzedCount ? (
        <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning-foreground">
          {t(
            'groups.intelUnanalyzedWarn',
            `${generate.data.unanalyzedCount} document(s) were excluded because they haven't been analyzed yet.`,
          )}
        </p>
      ) : null}

      <SummaryBody
        loading={summary.isLoading}
        summary={summary.data?.summary ?? generate.data?.summary ?? null}
        generatedAt={
          summary.data?.generatedAt ?? generate.data?.generatedAt ?? null
        }
        model={summary.data?.model ?? generate.data?.model ?? null}
      />
    </div>
  );
}

function SearchResults({
  hits,
  total,
  isLoading,
  isFetching,
  q,
}: {
  hits: Array<{
    kind: 'document' | 'source';
    refId: string;
    titleSnippet: string;
    snippet: string;
    type: string | null;
  }>;
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  q: string;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-foreground/55">
        <Spinner size="sm" className="mr-2" />
        {t('common.searching', 'Searching…')}
      </div>
    );
  }
  if (hits.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/40 px-3 py-6 text-center text-sm text-foreground/55">
        {t('groups.intelNoHits', `No matches for "${q}" in this group.`)}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-foreground/55">
        {t(
          'groups.intelHitsLabel',
          `${total} match${total === 1 ? '' : 'es'} in this group${isFetching ? ' \u2014 refreshing…' : ''}`,
        )}
      </p>
      <ul className="divide-y divide-border/70 rounded-md border border-border bg-background">
        {hits.map((hit) => (
          <li
            key={`${hit.kind}:${hit.refId}`}
            className="px-3 py-2.5 transition-colors hover:bg-secondary/40"
          >
            <Link
              to={hrefForHit(hit)}
              className="flex flex-col gap-1 text-sm text-foreground"
            >
              <span className="line-clamp-1 font-medium">
                <Highlighted text={hit.titleSnippet} />
              </span>
              {hit.snippet && (
                <span className="line-clamp-2 text-xs text-foreground/65">
                  <Highlighted text={hit.snippet} />
                </span>
              )}
              {hit.type && (
                <span className="text-[10px] uppercase tracking-wide text-foreground/45">
                  {hit.type}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryBody({
  loading,
  summary,
  generatedAt,
  model,
}: {
  loading: boolean;
  summary: string | null;
  generatedAt: string | null;
  model: string | null;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-secondary/50" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-secondary/50" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-secondary/50" />
      </div>
    );
  }
  if (!summary) {
    return (
      <p className="rounded-md border border-dashed border-border bg-secondary/40 px-3 py-8 text-center text-sm text-foreground/55">
        {t(
          'groups.intelNoSummary',
          'No summary yet. Click \u201cGenerate summary\u201d to build one from the documents\u2019 analyses.',
        )}
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-border bg-secondary/35 p-3 text-sm leading-relaxed text-foreground">
      <p className="whitespace-pre-wrap">{summary}</p>
      <p className="pt-1 text-[11px] text-foreground/50">
        {generatedAt
          ? `${t('common.generated', 'Generated')} ${new Date(generatedAt).toLocaleString()}`
          : ''}
        {model ? ` · ${model}` : ''}
      </p>
    </div>
  );
}
