import type { EstateDocAnalysis, EstateDocAnswer } from '@org/api-client';
import { Button, Card, FormField, Input, Spinner } from '@org/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useEstateService } from '../../documents/services-context';
import {
  useAddDocument,
  useAssetDocuments,
  useRemoveDocument,
} from '../queries';

/** Documents attached to an asset — periodic statements versioned by name +
 *  period date (docs/13 §2.3). Upload, download, remove. */
export function AssetDocuments({ assetId }: { assetId: string }) {
  const { t } = useTranslation();
  const { data: docs, isLoading } = useAssetDocuments(assetId);
  const add = useAddDocument(assetId);
  const remove = useRemoveDocument(assetId);
  const svc = useEstateService();
  const [period, setPeriod] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    add.mutate({ file, slotKey: file.name, periodAsOf: period || undefined });
    setPeriod('');
  };

  const download = async (docId: string) => {
    const { url } = await svc.documentUrl(assetId, docId);
    window.open(url, '_blank', 'noopener');
  };

  return (
    <Card className="space-y-3 p-5">
      <p className="text-sm font-semibold text-foreground">
        {t('estate.documents', 'Documents')}
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FormField label={t('estate.statementDate', 'Statement date (optional)')}>
            <Input
              type="date"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </FormField>
        </div>
        <label className="flex-none">
          <input
            type="file"
            className="hidden"
            accept="application/pdf,image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <span className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted/40">
            {add.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.uploadDocument', 'Upload')}
          </span>
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner className="h-4 w-4" />
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {(docs ?? []).length === 0 && (
            <p className="py-2 text-sm text-foreground/60">
              {t('estate.noDocuments', 'No documents yet.')}
            </p>
          )}
          {(docs ?? []).map((d) => (
            <div key={d.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{d.filename}</p>
                  <p className="text-xs text-foreground/50">
                    {d.periodAsOf
                      ? new Date(d.periodAsOf).toLocaleDateString('en-IN')
                      : new Date(d.uploadedAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setOpenId((cur) => (cur === d.id ? null : d.id))
                    }
                  >
                    {t('estate.analyze', 'Analyze')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => download(d.id)}>
                    {t('estate.download', 'Download')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.mutate(d.id)}
                  >
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
              {openId === d.id && (
                <DocAnalysisPanel assetId={assetId} docId={d.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Per-document analysis (summary, key dates, risks) + grounded Q&A — reuses the
 *  same analysis/RAG behaviour as the documents module, over the statement. */
function DocAnalysisPanel({
  assetId,
  docId,
}: {
  assetId: string;
  docId: string;
}) {
  const { t } = useTranslation();
  const svc = useEstateService();
  const [loaded, setLoaded] = useState(false);
  const [analysis, setAnalysis] = useState<EstateDocAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<EstateDocAnswer | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let alive = true;
    svc
      .documentAnalysis(assetId, docId)
      .then((r) => alive && setAnalysis(r.analysis))
      .catch(() => undefined)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [assetId, docId, svc]);

  const analyze = async (force: boolean) => {
    setBusy(true);
    try {
      setAnalysis(await svc.analyzeDocument(assetId, docId, force));
    } catch {
      toast.error(t('estate.analyzeFailed', 'Could not analyze this document.'));
    } finally {
      setBusy(false);
    }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await svc.askDocument(assetId, docId, q));
    } catch {
      toast.error(t('estate.askFailed', 'Could not answer that question.'));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
      {!loaded ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground/70">
              {t('estate.analysis', 'Analysis')}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => analyze(!!analysis)}
              disabled={busy}
            >
              {busy && <Spinner className="mr-2 h-4 w-4" />}
              {analysis
                ? t('estate.reanalyze', 'Re-analyze')
                : t('estate.runAnalysis', 'Analyze')}
            </Button>
          </div>

          {analysis ? (
            <div className="space-y-2 text-sm">
              {analysis.summary && (
                <p className="text-foreground/80">{analysis.summary}</p>
              )}
              {(analysis.keyDates?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground/55">
                    {t('estate.keyDates', 'Key dates')}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {analysis.keyDates.map((d, i) => (
                      <li key={i} className="text-foreground/75">
                        {[d.label, d.date].filter(Boolean).join(' — ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(analysis.riskFlags?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-medium text-warning">
                    {t('estate.riskFlags', 'Risk flags')}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {analysis.riskFlags.map((r, i) => (
                      <li key={i} className="text-foreground/75">
                        {r.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-foreground/55">
              {t('estate.notAnalyzed', 'Not analyzed yet.')}
            </p>
          )}

          <div className="space-y-2 border-t border-border/60 pt-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('estate.askPlaceholder', 'Ask about this document…')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') ask();
                  }}
                />
              </div>
              <Button size="sm" onClick={ask} disabled={asking || !question.trim()}>
                {asking && <Spinner className="mr-2 h-4 w-4" />}
                {t('estate.ask', 'Ask')}
              </Button>
            </div>
            {answer && (
              <div className="rounded-md bg-background p-2 text-sm">
                <p className="whitespace-pre-wrap text-foreground/85">
                  {answer.answer}
                </p>
                {answer.citations.length > 0 && (
                  <p className="mt-1 text-xs text-foreground/45">
                    {t('estate.pages', 'Pages')}:{' '}
                    {answer.citations.map((c) => c.page).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
