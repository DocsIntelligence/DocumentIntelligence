import { Button, Card } from '@org/ui';
import { cn } from '@org/utils';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentList } from './queries';
import { documentHref } from './document-href';

export function DocumentsList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useDocumentList();
  const docs = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('documents.title', 'My documents')}
          </h1>
          <p className="mt-1 text-foreground/60">
            {t(
              'documents.subtitle',
              'Drafts, signed copies, and shared documents.',
            )}
          </p>
        </div>
        <Button asChild>
          <Link to="/documents/new">
            {t('common.newDocument', 'New document')}
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-secondary/40"
            />
          ))}
        </div>
      )}

      {error && (
        <Card className="rounded-xl p-6">
          <p className="text-sm text-error">
            {t(
              'documents.loadError',
              'Could not load documents. Please try again.',
            )}
          </p>
        </Card>
      )}

      {!isLoading && !error && docs.length === 0 && (
        <Card className="rounded-xl border-dashed p-10 text-center">
          <p className="text-foreground/70">
            {t('dashboard.emptyTitle', 'No documents yet.')}
          </p>
          <p className="mt-1 text-sm text-foreground/50">
            {t(
              'documents.emptyDesc',
              'Start with a rent agreement, an RTI, a legal notice — or draft one with AI.',
            )}
          </p>
          <Button asChild className="mt-4">
            <Link to="/documents/new">
              {t('dashboard.createFirst', 'Create your first document')}
            </Link>
          </Button>
        </Card>
      )}

      {docs.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link
              key={d.id}
              to={documentHref(d)}
              className="group flex flex-col rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium uppercase tracking-wide text-foreground/50">
                  {d.documentType?.name ?? t('common.document', 'Document')}
                </span>
                <StatusPill status={d.status} />
              </div>
              <p className="mt-2 truncate font-semibold text-foreground group-hover:text-primary">
                {d.title || t('common.untitled', 'Untitled')}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                {d.template?.name ?? '—'} · {d.pageSize.replace(/_/g, ' ')}
              </p>
              <p className="mt-auto pt-3 text-xs text-foreground/40">
                {t('dashboard.updated', 'Updated {{date}}', {
                  date: new Date(d.updatedAt).toLocaleString(),
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    in_review: 'bg-blue-100 text-blue-800',
    ready: 'bg-emerald-100 text-emerald-800',
    signed: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-foreground/10 text-foreground/60',
  };
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone[status] ?? 'bg-foreground/10 text-foreground/60',
      )}
    >
      {t(`status.${status}`, status.replace(/_/g, ' '))}
    </span>
  );
}
