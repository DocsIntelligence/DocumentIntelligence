import type { ImportFileResult } from '@org/api-client';
import { Badge, Button, Card, Input, Spinner } from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/page-header';
import { formatMoney, useImportFiles } from '../queries';

interface Entry {
  file: File;
  password: string;
  result?: ImportFileResult;
}

/**
 * Bulk file import (docs/13 §11.3): drop many statements/policies at once
 * (e.g. 10 insurance PDFs). Each file becomes one asset with the file attached
 * as its document — extracted automatically. Password-protected files come back
 * flagged so you can type the password and re-run just those.
 */
export function EstateBulkImportPage() {
  const { t } = useTranslation();
  const importFiles = useImportFiles();
  const [entries, setEntries] = useState<Entry[]>([]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({ file, password: '' }));
    setEntries((prev) => [...prev, ...next]);
  };

  const setPassword = (i: number, password: string) =>
    setEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, password } : e)),
    );

  const removeEntry = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const pendingIndices = entries
    .map((e, i) => (e.result?.status === 'created' ? -1 : i))
    .filter((i) => i >= 0);

  const run = async () => {
    if (pendingIndices.length === 0) return;
    const files = pendingIndices.map((i) => entries[i].file);
    const passwords = pendingIndices.map((i) => entries[i].password || undefined);
    const res = await importFiles.mutateAsync({ files, passwords });
    // Results come back aligned to the files we sent (same order).
    setEntries((prev) => {
      const copy = [...prev];
      pendingIndices.forEach((entryIdx, k) => {
        if (res.results[k]) copy[entryIdx] = { ...copy[entryIdx], result: res.results[k] };
      });
      return copy;
    });
  };

  const createdCount = entries.filter(
    (e) => e.result?.status === 'created',
  ).length;
  const needsPwCount = entries.filter(
    (e) =>
      e.result?.status === 'password_required' ||
      e.result?.status === 'password_incorrect',
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('estate.bulkTitle', 'Bulk file import')}
        subtitle={t(
          'estate.bulkSubtitle',
          'Drop several statements or policies at once — each becomes its own asset with the file attached. Protected PDFs will ask for a password.',
        )}
        backTo="/estate"
      />

      <Card className="flex items-center justify-between gap-3 border-dashed p-5">
        <p className="text-sm text-foreground/70">
          {t('estate.bulkPrompt', 'Choose one or more PDFs or images.')}
        </p>
        <label className="flex-none">
          <input
            type="file"
            multiple
            className="hidden"
            accept="application/pdf,image/*"
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted/40">
            {t('estate.addFiles', 'Add files')}
          </span>
        </label>
      </Card>

      {entries.length > 0 && (
        <>
          <Card className="divide-y divide-border/60 p-0">
            {entries.map((e, i) => (
              <FileRow
                key={i}
                entry={e}
                onPassword={(v) => setPassword(i, v)}
                onRemove={() => removeEntry(i)}
              />
            ))}
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-foreground/60">
              {createdCount > 0 &&
                t('estate.bulkCreated', '{{n}} created', { n: createdCount })}
              {createdCount > 0 && needsPwCount > 0 && ' · '}
              {needsPwCount > 0 &&
                t('estate.bulkNeedsPw', '{{n}} need a password', {
                  n: needsPwCount,
                })}
            </span>
            <Button
              onClick={run}
              disabled={pendingIndices.length === 0 || importFiles.isPending}
            >
              {importFiles.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {createdCount > 0
                ? t('estate.importRemaining', 'Import remaining ({{n}})', {
                    n: pendingIndices.length,
                  })
                : t('estate.importAll', 'Import {{n}} files', {
                    n: pendingIndices.length,
                  })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FileRow({
  entry,
  onPassword,
  onRemove,
}: {
  entry: Entry;
  onPassword: (v: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const r = entry.result;
  const needsPw =
    r?.status === 'password_required' || r?.status === 'password_incorrect';

  return (
    <div className="space-y-2 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {r?.label || entry.file.name}
          </p>
          <p className="truncate text-xs text-foreground/55">
            {entry.file.name}
            {r?.type ? ` · ${r.type}` : ''}
          </p>
        </div>
        {r?.status === 'created' && r.value !== undefined && (
          <span className="flex-none text-sm font-medium">
            {formatMoney(r.value)}
          </span>
        )}
        <StatusBadge status={r?.status} />
        {r?.status === 'created' && r.assetId ? (
          <Button asChild variant="ghost" size="sm">
            <Link to={`/estate/assets/${r.assetId}`}>
              {t('common.view', 'View')}
            </Link>
          </Button>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="flex-none text-xs text-foreground/45 hover:text-destructive"
          >
            {t('common.remove', 'Remove')}
          </button>
        )}
      </div>

      {needsPw && (
        <Input
          type="password"
          value={entry.password}
          autoComplete="off"
          placeholder={t(
            'estate.filePassword',
            'Password for this file (e.g. PAN)',
          )}
          onChange={(ev) => onPassword(ev.target.value)}
        />
      )}
      {r?.status === 'failed' && r.error && (
        <p className="text-xs text-destructive">{r.error}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: ImportFileResult['status'] }) {
  const { t } = useTranslation();
  if (!status)
    return (
      <Badge variant="secondary" outline className="text-[10px]">
        {t('estate.stPending', 'Pending')}
      </Badge>
    );
  if (status === 'created')
    return (
      <Badge variant="success" className="text-[10px]">
        {t('estate.stCreated', 'Created')}
      </Badge>
    );
  if (status === 'failed')
    return (
      <Badge variant="secondary" className="text-[10px]">
        {t('estate.stFailed', 'Failed')}
      </Badge>
    );
  return (
    <Badge variant="warning" className="text-[10px]">
      {status === 'password_incorrect'
        ? t('estate.stPwWrong', 'Wrong password')
        : t('estate.stPwNeeded', 'Password needed')}
    </Badge>
  );
}

export default EstateBulkImportPage;
