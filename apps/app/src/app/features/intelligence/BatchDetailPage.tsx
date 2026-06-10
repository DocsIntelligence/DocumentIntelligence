import { Badge, Button, Card, CardContent, Spinner } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useBatch } from './queries';

const RUN_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'secondary'> = {
  completed: 'success',
  approved: 'success',
  needs_review: 'warning',
  failed: 'error',
  rejected: 'error',
  running: 'info',
  queued: 'secondary',
};

/** A batch's documents and their pipeline-run status (docs/07 P4.3). */
export function BatchDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: batch, isLoading } = useBatch(id);

  if (isLoading || !batch) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {batch.name ?? t('intelligence.batches.title', 'Batches')}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">
            {t('intelligence.batches.counts', '{{c}}/{{t}} done · {{r}} to review · {{f}} failed', {
              c: batch.completed,
              t: batch.total,
              r: batch.needsReview,
              f: batch.failed,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {batch.needsReview > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link to="/review-queue">
                {t('intelligence.batches.goReview', 'Review queue')}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link to="/batches">{t('common.back', 'Back')}</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {batch.runs.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <span className="truncate text-sm">{r.filename}</span>
              <div className="flex items-center gap-3">
                <Badge variant={RUN_VARIANT[r.status] ?? 'secondary'}>
                  {r.status}
                </Badge>
                {(r.status === 'needs_review' ||
                  r.status === 'completed' ||
                  r.status === 'approved') && (
                  <Link
                    to={`/analyze/${r.sourceDocumentId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('intelligence.batches.open', 'Open')}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
