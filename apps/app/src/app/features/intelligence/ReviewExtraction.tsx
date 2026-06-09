import type { ExtractionDetail } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from '@org/ui';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConvert, useSaveReview } from './queries';

interface Props {
  extraction: ExtractionDetail;
  sourceId: string;
}

/** Confidence → badge variant + label band. */
function confidenceBadge(score: number): {
  variant: 'success' | 'warning' | 'error';
  label: string;
} {
  if (score >= 0.85) return { variant: 'success', label: 'High' };
  if (score >= 0.6) return { variant: 'warning', label: 'Medium' };
  return { variant: 'error', label: 'Low' };
}

/** Render a stored value as an editable string; complex types as JSON. */
function toEditable(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/** Coerce an edited string back toward its original primitive type. */
function fromEditable(raw: string, original: unknown): unknown {
  if (typeof original === 'number') {
    const n = Number(raw);
    return Number.isNaN(n) ? raw : n;
  }
  if (typeof original === 'boolean') return raw === 'true';
  if (original && typeof original === 'object') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/**
 * The Phase-1 review UI (docs/05 §6, HITL). Shows every extracted field with
 * its calibrated confidence, flags low-confidence / required-missing fields for
 * review, and lets the user correct values before the extraction is marked
 * human-validated (which feeds the audit trail + active-learning signal).
 */
export function ReviewExtraction({ extraction, sourceId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useSaveReview(extraction.id, sourceId);
  const convert = useConvert();

  const original = extraction.fields;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of extraction.schema.fields) {
      init[f.key] = toEditable(original[f.key]);
    }
    return init;
  });

  const flagged = useMemo(
    () => new Set(extraction.review.flaggedFields),
    [extraction.review.flaggedFields],
  );

  const collectPayload = () => {
    const fields: Record<string, unknown> = {};
    const edits: { fieldPath: string; newValue: unknown }[] = [];
    for (const f of extraction.schema.fields) {
      const editedRaw = values[f.key] ?? '';
      const coerced = fromEditable(editedRaw, original[f.key]);
      fields[f.key] = coerced;
      if (toEditable(original[f.key]) !== editedRaw) {
        edits.push({ fieldPath: f.key, newValue: coerced });
      }
    }
    return { fields, edits, markReviewed: true };
  };

  const onSave = async () => {
    await save.mutateAsync(collectPayload());
  };

  // Save the corrected values first (so the document is built from them), then
  // convert to an editable Document and open it in the right editor.
  const onCreateDocument = async () => {
    await save.mutateAsync(collectPayload());
    const res = await convert.mutateAsync(extraction.id);
    navigate(
      res.mode === 'structured'
        ? `/documents/${res.documentId}/edit`
        : `/documents/${res.documentId}/draft`,
    );
  };

  const busy = save.isPending || convert.isPending;

  const overallPct = Math.round(extraction.overallConfidence * 100);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>
              {extraction.schema.name}
              {extraction.reviewed && (
                <Badge variant="success" className="ml-2 align-middle">
                  {t('intelligence.review.reviewed', 'Reviewed')}
                </Badge>
              )}
            </CardTitle>
            <p className="mt-1 text-sm text-foreground/60">
              {t('intelligence.review.overall', 'Overall confidence')}: {overallPct}%
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSave} disabled={busy}>
              {save.isPending && !convert.isPending
                ? t('intelligence.review.saving', 'Saving…')
                : t('intelligence.review.save', 'Save review')}
            </Button>
            <Button onClick={onCreateDocument} disabled={busy}>
              {convert.isPending
                ? t('intelligence.review.creating', 'Creating…')
                : t('intelligence.review.createDoc', 'Create editable document')}
            </Button>
          </div>
        </CardHeader>
        {extraction.review.needsReview && (
          <CardContent>
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="font-medium">
                {t('intelligence.review.needsReview', 'Needs review')}
              </p>
              <ul className="mt-1 list-inside list-disc text-foreground/70">
                {extraction.review.reasons.length > 0 ? (
                  extraction.review.reasons.map((r) => <li key={r}>{r}</li>)
                ) : (
                  <li>
                    {t(
                      'intelligence.review.lowConfidenceFields',
                      'Some fields have low confidence — please verify the highlighted values.',
                    )}
                  </li>
                )}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {extraction.schema.fields.map((field) => {
            const conf = extraction.confidence[field.key];
            const score = conf?.confidence ?? 0;
            const present = field.key in original && original[field.key] !== '';
            const badge = confidenceBadge(score);
            const isFlagged = flagged.has(field.key);
            const isComplex =
              original[field.key] !== null &&
              typeof original[field.key] === 'object';

            return (
              <div
                key={field.key}
                className={`grid grid-cols-1 gap-2 p-4 sm:grid-cols-[220px_1fr_auto] sm:items-start ${
                  isFlagged ? 'bg-warning/5' : ''
                }`}
              >
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">
                    {field.label}
                    {field.required && (
                      <span className="ml-0.5 text-error">*</span>
                    )}
                  </label>
                  {field.description && (
                    <p className="text-xs text-foreground/50">
                      {field.description}
                    </p>
                  )}
                </div>

                <div>
                  {isComplex ? (
                    <Textarea
                      value={values[field.key] ?? ''}
                      rows={3}
                      className="font-mono text-xs"
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      value={values[field.key] ?? ''}
                      placeholder={
                        present
                          ? undefined
                          : t('intelligence.review.notFound', 'Not found')
                      }
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  {present ? (
                    <Badge variant={badge.variant} outline>
                      {badge.label} · {Math.round(score * 100)}%
                    </Badge>
                  ) : (
                    <Badge variant="secondary" outline>
                      {t('intelligence.review.missing', 'Missing')}
                    </Badge>
                  )}
                  {conf?.provenance?.page != null && (
                    <span className="text-xs text-foreground/40">
                      {t('intelligence.review.page', 'p.{{n}}', {
                        n: conf.provenance.page,
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
