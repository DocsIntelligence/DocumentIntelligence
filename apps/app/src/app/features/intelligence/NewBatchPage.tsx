import {
  Button,
  Card,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  DOC_ACCEPT,
  MAX_FILE_SIZE_MB,
  partitionDocumentFiles,
} from '../../lib/file-validation';
import { useCreateBatch, usePipelineOptions } from './queries';
import { ArrowRightIcon, UploadIcon } from './icons';

const MAX_BATCH_NAME = 120;

/**
 * Dedicated "New batch" page (split out of BatchesPage): pick many files, choose
 * a pipeline, and run. On success it jumps to the new batch's detail page.
 */
export function NewBatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateBatch();
  const { data: pipelines } = usePipelineOptions();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [pipeline, setPipeline] = useState('default');

  const nameTooLong = name.trim().length > MAX_BATCH_NAME;

  // Accumulate across multiple picks (dedupe by name+size+lastModified) so the
  // user can build a batch in several shots; reset the input value each time so
  // re-selecting the same file still fires onChange. Reject unsupported/oversized
  // files with an inline message instead of silently dropping them.
  const addFiles = (picked: FileList | null) => {
    if (!picked?.length) return;
    // Snapshot NOW: FileList is live and tied to the input element, so the
    // value reset below would empty it before React runs the state updater.
    const incoming = Array.from(picked);
    if (inputRef.current) inputRef.current.value = '';
    const { accepted, rejected: bad } = partitionDocumentFiles(incoming);
    setRejected(
      bad.map((r) =>
        r.reason === 'size'
          ? t(
              'intelligence.batches.errSize',
              '{{name}} — too large (max {{mb}} MB)',
              {
                name: r.file.name,
                mb: MAX_FILE_SIZE_MB,
              },
            )
          : r.reason === 'empty'
            ? t('intelligence.batches.errEmpty', '{{name}} — empty file', {
                name: r.file.name,
              })
            : t('intelligence.batches.errType', '{{name}} — unsupported type', {
                name: r.file.name,
              }),
      ),
    );
    setFiles((prev) => {
      const seen = new Set(
        prev.map((f) => `${f.name}:${f.size}:${f.lastModified}`),
      );
      const next = [...prev];
      for (const f of accepted) {
        const k = `${f.name}:${f.size}:${f.lastModified}`;
        if (!seen.has(k)) {
          seen.add(k);
          next.push(f);
        }
      }
      return next;
    });
  };
  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onCreate = async () => {
    if (!files.length || nameTooLong) return;
    const res = await create.mutateAsync({
      files,
      name: name.trim() || undefined,
      pipeline: pipeline || undefined,
    });
    navigate(`/batches/${res.batchId}`);
  };

  return (
    <div className="mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('intelligence.batches.new', 'New batch')}
          </h1>
          <p className="mt-1 text-foreground/60">
            {t(
              'intelligence.batches.newHint',
              'Select multiple files (PDF, Word, text, images).',
            )}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/batches" className="gap-1.5">
            {t('intelligence.batches.all', 'All batches')}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>

      <Card className="rounded-xl">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/35 text-primary">
            <UploadIcon className="size-5" />
          </span>
          <div>
            <p className="font-semibold text-foreground">
              {t('intelligence.batches.upload', 'Upload documents')}
            </p>
            <p className="text-xs text-foreground/55">
              {t(
                'intelligence.batches.newHint',
                'Select multiple files (PDF, Word, text, images).',
              )}
            </p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-foreground/60">
            {t('intelligence.batches.nameLabel', 'Batch name')}
            <span className="ml-1 text-foreground/40">
              {t('common.optional', '(optional)')}
            </span>
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(
              'intelligence.batches.namePlaceholder',
              'e.g. April vendor invoices',
            )}
            hasError={nameTooLong}
            maxLength={MAX_BATCH_NAME + 20}
            className="mt-1"
          />
          {nameTooLong && (
            <span role="alert" className="text-xs text-error">
              {t(
                'intelligence.batches.nameTooLong',
                'Keep the name under {{n}} characters.',
                {
                  n: MAX_BATCH_NAME,
                },
              )}
            </span>
          )}
        </label>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={DOC_ACCEPT}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/70 bg-secondary/40 p-8 text-center transition hover:border-primary/50 hover:bg-secondary/50"
        >
          <span className="text-sm font-medium">
            {files.length
              ? t('intelligence.batches.addMore', 'Add more files')
              : t('intelligence.batches.choose', 'Choose files')}
          </span>
          <span className="text-xs text-foreground/50">
            {files.length
              ? t('intelligence.batches.selected', '{{n}} files selected', {
                  n: files.length,
                })
              : t('intelligence.upload.clickToBrowse', 'Click to browse')}
          </span>
        </button>

        {rejected.length > 0 && (
          <ul
            role="alert"
            className="rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-xs text-error space-y-0.5"
          >
            {rejected.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <ul className="divide-y divide-border/60 rounded-lg border border-border">
            {files.map((f, i) => (
              <li
                key={`${f.name}:${f.size}:${f.lastModified}`}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {f.name}
                </span>
                <span className="flex-none tabular-nums text-xs text-foreground/45">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  aria-label={t('common.remove', 'Remove')}
                  onClick={() => removeFile(i)}
                  className="flex-none rounded p-1 text-foreground/50 hover:bg-error/50 hover:text-error"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 text-sm">
            <span className="text-foreground/60">
              {t('intelligence.batches.pipeline', 'Pipeline')}
            </span>
            <Select value={pipeline} onValueChange={setPipeline}>
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(pipelines ?? [{ key: 'default', name: 'Default' }]).map(
                  (p: { key: string; name: string }) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </label>
          <Button
            onClick={onCreate}
            disabled={!files.length || nameTooLong || create.isPending}
            className="sm:w-48"
          >
            {create.isPending
              ? t('intelligence.batches.starting', 'Starting…')
              : t('intelligence.batches.start', 'Upload & run batch')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default NewBatchPage;
