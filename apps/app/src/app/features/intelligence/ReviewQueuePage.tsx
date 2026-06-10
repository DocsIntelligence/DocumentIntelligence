import { Badge, Button, Card, CardContent } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useApproveRun, useReviewQueue } from './queries';

/**
 * Review queue (docs/07 P4.4): pipeline runs parked for human review. Open one
 * to inspect/correct, then approve to finalize (export). Bulk-friendly layout.
 */
export function ReviewQueuePage() {
  const { t } = useTranslation();
  const { data: items, isLoading } = useReviewQueue();
  const approve = useApproveRun();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('intelligence.queue.title', 'Review queue')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'intelligence.queue.subtitle',
            'Documents the pipeline flagged for a human check before finalizing.',
          )}
        </p>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-foreground/50">…</p>
      ) : items && items.length > 0 ? (
        <Card>
          <CardContent className="divide-y divide-border/60 p-0">
            {items.map((item) => (
              <div
                key={item.pipelineRunId}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.filename}</p>
                  <p className="text-xs text-foreground/50">
                    {item.documentTypeKey ?? t('intelligence.queue.unknownType', 'unknown type')}
                    {item.overallConfidence != null &&
                      ` · ${Math.round(item.overallConfidence * 100)}%`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {item.overallConfidence != null && (
                    <Badge
                      variant={
                        item.overallConfidence >= 0.85 ? 'success' : 'warning'
                      }
                      outline
                    >
                      {Math.round(item.overallConfidence * 100)}%
                    </Badge>
                  )}
                  <Link
                    to={`/analyze/${item.sourceDocumentId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {t('intelligence.queue.review', 'Review')}
                  </Link>
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(item.pipelineRunId)}
                  >
                    {t('intelligence.queue.approve', 'Approve & finish')}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <p className="py-8 text-center text-sm text-foreground/50">
          {t('intelligence.queue.empty', 'Nothing to review. 🎉')}
        </p>
      )}
    </div>
  );
}
