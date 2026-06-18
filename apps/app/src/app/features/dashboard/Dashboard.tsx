import { selectUser, useAppSelector } from '@org/store';
import { Button, Card } from '@org/ui';
import { cn } from '@org/utils';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/page-header';
import { useDocumentList } from '../documents/queries';
import { documentHref } from '../documents/document-href';

export function Dashboard() {
  const user = useAppSelector(selectUser);
  const { t } = useTranslation();
  const { data: docs, isLoading } = useDocumentList();
  // Most-recently-updated first, so "Recent" actually reflects recency
  // regardless of the list endpoint's default ordering.
  const recent = [...(docs ?? [])]
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <PageHeader
        back={false}
        title={`${greeting(t)}${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle={t(
          'dashboard.subtitle',
          'Draft, edit, and export legal documents — with AI assistance.',
        )}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          to="/documents/draft-ai"
          accent
          icon={<SparklesIcon />}
          title={t('dashboard.draftAiTitle', 'Draft with AI')}
          desc={t(
            'dashboard.draftAiDesc',
            'Describe what you need in plain English and get a full draft.',
          )}
        />
        <ActionCard
          to="/documents/templates"
          icon={<TemplateIcon />}
          title={t('templates.title', 'Templates')}
          desc={t(
            'dashboard.templatesDesc',
            'Start from a structured document type with guided fields.',
          )}
        />
        <ActionCard
          to="/editor"
          icon={<PenIcon />}
          title={t('dashboard.blankTitle', 'Blank editor')}
          desc={t(
            'dashboard.blankDesc',
            'Write from scratch with transliteration and live preview.',
          )}
        />
        <ActionCard
          to="/documents"
          icon={<DocsIcon />}
          title={t('dashboard.myDocsTitle', 'My documents')}
          desc={t(
            'dashboard.myDocsDesc',
            'Open, export, and manage your drafts and signed copies.',
          )}
        />
      </div>

      {/* Document Intelligence */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          {t('nav.docIntel', 'Document Intelligence')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ActionCard
            to="/analyze"
            icon={<ScanIcon />}
            title={t('dashboard.analyzeTitle', 'Analyze a document')}
            desc={t(
              'dashboard.analyzeDesc',
              'Upload a file to classify and extract its fields.',
            )}
          />
          <ActionCard
            to="/batches"
            icon={<LayersIcon />}
            title={t('nav.batches', 'Batches')}
            desc={t(
              'dashboard.batchesDesc',
              'Process many documents at once and track progress.',
            )}
          />
          <ActionCard
            to="/review-queue"
            icon={<InboxIcon />}
            title={t('nav.reviewQueue', 'Review queue')}
            desc={t(
              'dashboard.reviewDesc',
              'Check and approve documents the pipeline flagged.',
            )}
          />
        </div>
      </section>

      {/* Recent documents */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {t('dashboard.recent', 'Recent')}
          </h2>
          {recent.length > 0 && (
            <Link
              to="/documents"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t('common.viewAll', 'View all')}
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[88px] animate-pulse rounded-xl bg-secondary/40"
              />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <Card className="rounded-xl border-dashed p-8 text-center">
            <p className="text-foreground/70">
              {t('dashboard.emptyTitle', 'No documents yet.')}
            </p>
            <p className="mt-1 text-sm text-foreground/50">
              {t(
                'dashboard.emptyDesc',
                'Start with a rent agreement, RTI, legal notice — or an AI draft.',
              )}
            </p>
            <Button asChild className="mt-4">
              <Link to="/documents/new">
                {t('dashboard.createFirst', 'Create your first document')}
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recent.map((d) => (
              <Link
                key={d.id}
                to={documentHref(d)}
                className="group rounded-xl border border-border bg-background p-4 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium uppercase tracking-wide text-foreground/50">
                    {d.documentType?.name ?? t('common.document', 'Document')}
                  </span>
                  <StatusPill status={d.status} />
                </div>
                <p className="mt-1 truncate font-medium text-foreground group-hover:text-primary">
                  {d.title || t('common.untitled', 'Untitled')}
                </p>
                <p className="mt-0.5 text-xs text-foreground/45">
                  {t('dashboard.updated', 'Updated {{date}}', {
                    date: new Date(d.updatedAt).toLocaleDateString(),
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;

// ─── pieces ──────────────────────────────────────────────────────────────

function ActionCard({
  to,
  icon,
  title,
  desc,
  accent,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  desc: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group flex flex-col rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md',
        accent
          ? 'border-primary/40 bg-primary/5 hover:border-primary/50'
          : 'border-border bg-background hover:border-primary/40',
      )}
    >
      <span
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg',
          accent
            ? 'bg-primary/35 text-primary'
            : 'bg-secondary/60 text-foreground/70 group-hover:text-primary',
        )}
      >
        {icon}
      </span>
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-foreground/55">{desc}</p>
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800',
    in_review: 'bg-blue-100 text-blue-800',
    ready: 'bg-emerald-100 text-emerald-800',
    signed: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-foreground/50 text-foreground/60',
  };
  return (
    <span
      className={cn(
        'flex-none rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tone[status] ?? 'bg-foreground/50 text-foreground/60',
      )}
    >
      {t(`status.${status}`, status.replace(/_/g, ' '))}
    </span>
  );
}

function greeting(t: TFunction): string {
  const h = new Date().getHours();
  if (h < 12) return t('greeting.morning', 'Good morning');
  if (h < 17) return t('greeting.afternoon', 'Good afternoon');
  return t('greeting.evening', 'Good evening');
}

// ─── icons ───────────────────────────────────────────────────────────────

function SparklesIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9.9-2.7z" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function TemplateIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  );
}
function ScanIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function InboxIcon() {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
