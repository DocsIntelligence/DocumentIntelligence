import type {
  AssetSuggestion,
  CreateAssetPayload,
  ExtractHoldingsResult,
} from '@org/api-client';
import { Button, Card, Checkbox, Input, Spinner } from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../../../components/page-header';
import { useEstateService } from '../../documents/services-context';
import { isPdfPasswordError } from '../queries';
import { formatMoney, useBulkCreateAssets } from '../queries';

/** CAS hero-upload (docs/13 §11.3): one consolidated statement → many holdings
 *  → review → bulk import. One upload populates most of a portfolio. */
export function EstateImportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const svc = useEstateService();
  const bulk = useBulkCreateAssets();

  const [holdings, setHoldings] = useState<AssetSuggestion[] | null>(null);
  const [recon, setRecon] = useState<
    ExtractHoldingsResult['reconciliation'] | null
  >(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [extracting, setExtracting] = useState(false);
  // Last chosen file + password, so a protected PDF can be retried after the
  // user types the password (CAS statements are typically password-locked).
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);

  const extract = async (f: File, pwd: string) => {
    setExtracting(true);
    setHoldings(null);
    setRecon(null);
    try {
      const res = await svc.extractHoldings(f, pwd || undefined);
      setHoldings(res.holdings);
      setRecon(res.reconciliation);
      setSelected(new Set(res.holdings.map((_, i) => i)));
      setNeedsPassword(false);
      if (res.holdings.length === 0) {
        toast.message(t('estate.noHoldings', 'No holdings found in that file.'));
      }
    } catch (e) {
      const pw = isPdfPasswordError(e);
      if (pw) {
        setNeedsPassword(true);
        toast.error(
          pw === 'incorrect'
            ? t('estate.pwWrong', 'That password didn’t work — try again.')
            : t(
                'estate.pwNeeded',
                'This statement is password-protected. Enter its password and retry.',
              ),
        );
      } else {
        toast.error(t('estate.extractFailed', 'Could not read that document.'));
      }
    } finally {
      setExtracting(false);
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setNeedsPassword(false);
    void extract(f, password);
  };

  const toggle = (i: number) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
  };

  const importSelected = async () => {
    if (!holdings) return;
    const payload: CreateAssetPayload[] = [...selected]
      .map((i) => holdings[i])
      .filter(Boolean)
      .map((h) => ({
        type: h.type ?? 'other',
        label: h.label || h.institution || t('estate.importedAsset', 'Imported asset'),
        institution: h.institution,
        value: h.value,
        units: h.units,
        identifier: h.identifier,
        maturityDate: h.maturityDate,
        currency: h.currency ?? 'INR',
        details: h.details,
      }));
    if (payload.length === 0) return;
    // Keep the original statement (with its password) attached to the imported
    // assets so it can be re-opened / re-extracted later.
    await bulk.mutateAsync({
      assets: payload,
      source: file ? { file, password: password || undefined } : undefined,
    });
    navigate('/estate/assets');
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('estate.importTitle', 'Import from a statement')}
        subtitle={t(
          'estate.importSubtitle',
          'Upload one consolidated statement (e.g. a CAMS/KFintech CAS) and we’ll pull out every holding for you to review.',
        )}
        backTo="/estate"
      />

      <Card className="space-y-3 border-dashed p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-foreground/70">
            {t('estate.importPrompt', 'Choose a PDF or image of your statement.')}
          </p>
          <label className="flex-none">
            <input
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className="inline-flex cursor-pointer items-center rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted/40">
              {extracting && <Spinner className="mr-2 h-4 w-4" />}
              {file
                ? t('estate.reupload', 'Choose another')
                : t('estate.uploadStatement', 'Upload')}
            </span>
          </label>
        </div>

        {/* Password row — shown after a protected PDF is detected, but a user
            can also pre-fill it (CAS statements are password-locked). */}
        {(needsPassword || file) && (
          <div className="flex items-end gap-2 border-t border-border/60 pt-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-foreground/70">
                {t('estate.pdfPassword', 'PDF password (if protected)')}
              </label>
              <Input
                type="password"
                value={password}
                autoComplete="off"
                placeholder={t(
                  'estate.pdfPasswordPh',
                  'e.g. your PAN, for a CAS statement',
                )}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && file) void extract(file, password);
                }}
              />
            </div>
            <Button
              variant="outline"
              disabled={!file || extracting || !password}
              onClick={() => file && extract(file, password)}
            >
              {extracting && <Spinner className="mr-2 h-4 w-4" />}
              {t('estate.unlockRetry', 'Unlock & read')}
            </Button>
          </div>
        )}
      </Card>

      {recon && holdings && holdings.length > 0 && (
        <ReconciliationBanner
          recon={recon}
          currency={holdings[0]?.currency ?? 'INR'}
        />
      )}

      {holdings && holdings.length > 0 && (
        <>
          <Card className="divide-y divide-border/60 p-0">
            {holdings.map((h, i) => (
              <label
                key={i}
                className="flex items-center gap-3 px-5 py-3 text-sm"
              >
                <Checkbox
                  checked={selected.has(i)}
                  onCheckedChange={() => toggle(i)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {h.label || h.institution || t('estate.importedAsset', 'Imported asset')}
                  </p>
                  <p className="truncate text-xs text-foreground/60">
                    {[
                      h.type,
                      h.institution,
                      h.identifier,
                      h.units !== undefined
                        ? t('estate.unitsN', '{{n}} units', {
                            n: h.units.toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            }),
                          })
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                {h.value !== undefined && (
                  <span className="flex-none font-medium">
                    {formatMoney(h.value, h.currency ?? 'INR')}
                  </span>
                )}
              </label>
            ))}
          </Card>

          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-foreground/60">
              {t('estate.selectedCount', '{{n}} selected', { n: selected.size })}
            </span>
            <Button
              onClick={importSelected}
              disabled={selected.size === 0 || bulk.isPending}
            >
              {bulk.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('estate.importSelected', 'Import selected')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Cross-check banner: extracted total vs the statement's printed grand total,
 *  so an incomplete/truncated extraction is surfaced before importing. */
function ReconciliationBanner({
  recon,
  currency,
}: {
  recon: ExtractHoldingsResult['reconciliation'];
  currency: string;
}) {
  const { t } = useTranslation();
  const extracted = formatMoney(recon.extractedTotal, currency);

  // No printed total to compare against — neutral note.
  if (recon.statedTotal === undefined || recon.matched === undefined) {
    return (
      <div className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground/70">
        {t(
          'estate.reconNoTotal',
          'Extracted {{count}} holdings totalling {{extracted}}. The statement didn’t print a grand total to cross-check against — please review the list for anything missing.',
          { count: recon.holdingsExtracted, extracted },
        )}
      </div>
    );
  }

  const stated = formatMoney(recon.statedTotal, currency);

  if (recon.matched) {
    return (
      <div className="rounded-md border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
        {t(
          'estate.reconMatched',
          'Reconciled ✓ — {{count}} holdings totalling {{extracted}} match the statement’s total of {{stated}}.',
          { count: recon.holdingsExtracted, extracted, stated },
        )}
      </div>
    );
  }

  // Mismatch — most often an under-count (truncated/missed holdings).
  const off = Math.abs(recon.deltaPct ?? 0);
  return (
    <div className="rounded-md border border-warning/50 bg-warning/10 px-4 py-3 text-sm text-foreground">
      <p className="font-medium">
        {t('estate.reconMismatchTitle', 'Totals don’t match — review before importing')}
      </p>
      <p className="mt-1 text-foreground/80">
        {t(
          'estate.reconMismatchBody',
          'We extracted {{count}} holdings totalling {{extracted}}, but the statement’s grand total is {{stated}} ({{off}}% off). Some holdings may have been missed or mis-read — check the list, fix amounts, or re-upload a clearer copy.',
          { count: recon.holdingsExtracted, extracted, stated, off },
        )}
      </p>
    </div>
  );
}
