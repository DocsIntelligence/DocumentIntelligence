import { Button, Card, CardContent, Spinner } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useExtraction, useIntelligenceJob } from './queries';
import { DocumentInsights } from './DocumentInsights';
import { ReviewExtraction } from './ReviewExtraction';

const STAGE_LABELS: Record<string, string> = {
  uploaded: 'Queued',
  normalize: 'Reading document',
  classify: 'Identifying document type',
  extract: 'Extracting fields',
  analyse: 'Analysing',
  review: 'Finalising',
};

/**
 * Poll an extraction job to completion, then render the review UI. While the
 * job runs we show its current stage; on failure we surface the error with a
 * retry path back to upload.
 */
export function AnalyzePage() {
  const { t } = useTranslation();
  const { sourceId } = useParams<{ sourceId: string }>();
  const [search] = useSearchParams();
  const jobId = search.get('job') ?? undefined;

  const job = useIntelligenceJob(jobId);
  const status = job.data?.status;
  const isTerminal =
    status === 'completed' || status === 'needs_review' || status === 'failed';

  // Fetch the extraction once the job finished — or immediately when opened
  // directly (no job param, e.g. from a batch or the review queue).
  const extractionQuery = useExtraction(
    sourceId,
    !jobId || (isTerminal && status !== 'failed'),
  );

  if (jobId && (job.isLoading || !isTerminal)) {
    const stage = job.data?.stage ?? 'uploaded';
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Spinner />
            <div>
              <p className="font-medium">
                {t('intelligence.analyze.working', 'Analyzing your document…')}
              </p>
              <p className="mt-1 text-sm text-foreground/60">
                {t(`intelligence.stage.${stage}`, STAGE_LABELS[stage] ?? stage)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="space-y-4 py-10 text-center">
            <p className="font-medium text-error">
              {t('intelligence.analyze.failed', 'Extraction failed')}
            </p>
            <p className="text-sm text-foreground/60">
              {job.data?.error ??
                t('intelligence.analyze.failedHint', 'Something went wrong.')}
            </p>
            <Button asChild variant="outline">
              <Link to="/analyze">
                {t('intelligence.analyze.tryAgain', 'Try another document')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (extractionQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <Spinner />
      </div>
    );
  }

  const extraction = extractionQuery.data?.extraction;
  if (!extraction) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-foreground/60">
        {t('intelligence.analyze.noExtraction', 'No extraction found.')}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('intelligence.analyze.reviewTitle', 'Review extraction')}
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/analyze">
            {t('intelligence.analyze.newUpload', 'Analyze another')}
          </Link>
        </Button>
      </div>
      <ReviewExtraction
        key={extraction.id}
        extraction={extraction}
        sourceId={sourceId as string}
      />
      <DocumentInsights sourceId={sourceId as string} />
    </div>
  );
}
