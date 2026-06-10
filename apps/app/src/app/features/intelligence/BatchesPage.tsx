import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@org/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useBatches, useCreateBatch, usePipelineOptions } from './queries';

const ACCEPT =
  '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  completed: 'success',
  needs_review: 'warning',
  failed: 'error',
  running: 'info',
};

/**
 * Batches (docs/07 P4.3): upload many documents at once, run them all through a
 * pipeline, and watch progress. The 1000-document case (multi-file for now).
 */
export function BatchesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateBatch();
  const { data: batches } = useBatches();
  const { data: pipelines } = usePipelineOptions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [pipeline, setPipeline] = useState('default');

  const onCreate = async () => {
    if (!files.length) return;
    const res = await create.mutateAsync({
      files,
      pipeline: pipeline || undefined,
    });
    navigate(`/batches/${res.batchId}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('intelligence.batches.title', 'Batches')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'intelligence.batches.subtitle',
            'Upload many documents at once — they’re classified, extracted, and queued for review automatically.',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('intelligence.batches.new', 'New batch')}</CardTitle>
          <CardDescription>
            {t(
              'intelligence.batches.newHint',
              'Select multiple files (PDF, Word, text, images).',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/70 bg-secondary/30 p-8 text-center transition hover:border-primary/50 hover:bg-secondary/50"
          >
            <span className="text-sm font-medium">
              {files.length
                ? t('intelligence.batches.selected', '{{n}} files selected', {
                    n: files.length,
                  })
                : t('intelligence.batches.choose', 'Choose files')}
            </span>
            <span className="text-xs text-foreground/50">
              {t('intelligence.upload.clickToBrowse', 'Click to browse')}
            </span>
          </button>
          <label className="block text-sm">
            <span className="text-foreground/60">
              {t('intelligence.batches.pipeline', 'Pipeline')}
            </span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              value={pipeline}
              onChange={(e) => setPipeline(e.target.value)}
            >
              {(pipelines ?? [{ key: 'default', name: 'Default' }]).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-foreground/50">
              {t(
                'intelligence.batches.pipelineHint',
                'Which processing flow to run. Manage pipelines in Admin → Document Intelligence.',
              )}
            </span>
          </label>
          <Button
            onClick={onCreate}
            disabled={!files.length || create.isPending}
            className="w-full"
          >
            {create.isPending
              ? t('intelligence.batches.starting', 'Starting…')
              : t('intelligence.batches.start', 'Upload & run batch')}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(batches ?? []).map((b) => (
          <Link key={b.id} to={`/batches/${b.id}`}>
            <Card className="transition hover:border-primary/40">
              <CardContent className="flex items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">{b.name ?? b.id}</p>
                  <p className="text-xs text-foreground/50">
                    {t('intelligence.batches.counts', '{{c}}/{{t}} done · {{r}} to review · {{f}} failed', {
                      c: b.completed,
                      t: b.total,
                      r: b.needsReview,
                      f: b.failed,
                    })}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>
                  {b.status}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {batches && batches.length === 0 && (
          <p className="py-8 text-center text-sm text-foreground/50">
            {t('intelligence.batches.empty', 'No batches yet.')}
          </p>
        )}
      </div>
    </div>
  );
}
