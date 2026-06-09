import type { EngineMode } from '@org/api-client';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUploadDocument } from './queries';

const ACCEPT =
  '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg';

/**
 * Upload an existing document for understanding (docs/05). Choose the
 * extraction tier; the file is classified + extracted asynchronously and the
 * user is taken to the analyze/review page to poll progress.
 */
export function IntelligenceUpload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const upload = useUploadDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [engine, setEngine] = useState<EngineMode>('auto');

  const onSubmit = async () => {
    if (!file) return;
    const res = await upload.mutateAsync({ file, engine });
    navigate(`/analyze/${res.sourceDocumentId}?job=${res.jobId}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('intelligence.upload.title', 'Analyze a document')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'intelligence.upload.subtitle',
            'Upload an existing document — we read it, extract the key fields, and let you review before using it.',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('intelligence.upload.fileTitle', 'Document')}</CardTitle>
          <CardDescription>
            {t(
              'intelligence.upload.fileHint',
              'PDF, Word (.docx), text, or an image (PNG/JPEG).',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-secondary/30 p-8 text-center transition hover:border-primary/50 hover:bg-secondary/50"
          >
            <span className="text-sm font-medium">
              {file
                ? file.name
                : t('intelligence.upload.choose', 'Choose a file to upload')}
            </span>
            <span className="text-xs text-foreground/50">
              {file
                ? `${(file.size / 1024).toFixed(0)} KB`
                : t('intelligence.upload.clickToBrowse', 'Click to browse')}
            </span>
          </button>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('intelligence.upload.engine', 'Extraction engine')}
            </label>
            <Select
              value={engine}
              onValueChange={(v) => setEngine(v as EngineMode)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  {t('intelligence.engine.auto', 'Automatic (recommended)')}
                </SelectItem>
                <SelectItem value="native">
                  {t('intelligence.engine.native', 'Fast — text layer only')}
                </SelectItem>
                <SelectItem value="vlm">
                  {t('intelligence.engine.vlm', 'Vision — for scanned files')}
                </SelectItem>
                <SelectItem value="agentic">
                  {t('intelligence.engine.agentic', 'Premium — agentic (highest accuracy)')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-foreground/50">
              {t(
                'intelligence.upload.engineHint',
                'Automatic uses the fast text path and escalates only when needed. Premium is a paid add-on.',
              )}
            </p>
          </div>

          <Button
            onClick={onSubmit}
            disabled={!file || upload.isPending}
            className="w-full"
          >
            {upload.isPending
              ? t('intelligence.upload.uploading', 'Uploading…')
              : t('intelligence.upload.start', 'Upload & analyze')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
