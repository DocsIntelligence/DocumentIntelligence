import { zodResolver } from '@hookform/resolvers/zod';
import type { ExtractionDetail } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import type { TFunction } from 'i18next';
import { useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import {
  useConvert,
  useReprocess,
  useSaveReview,
  useSchemaOptions,
} from './queries';

const GENERIC_SCHEMA_KEY = 'generic_document';

interface Props {
  extraction: ExtractionDetail;
  sourceId: string;
}

interface ReviewValues {
  fields: Record<string, string>;
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
 * Build a per-field validation schema from the extraction's own fields, so the
 * review form rejects bad edits BEFORE save (a malformed JSON / non-numeric
 * value used to be silently saved as a raw string — data corruption). Required
 * fields must be non-empty; complex fields must be valid JSON; number/currency
 * fields must parse as numbers.
 */
function buildReviewSchema(
  t: TFunction,
  fields: ExtractionDetail['schema']['fields'],
  original: Record<string, unknown>,
) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) {
    const isComplex =
      original[f.key] !== null && typeof original[f.key] === 'object';
    const isNumeric = f.type === 'number' || f.type === 'currency';
    shape[f.key] = z.string().superRefine((val, ctx) => {
      const v = (val ?? '').trim();
      if (!v) {
        if (f.required)
          ctx.addIssue({
            code: 'custom',
            message: t('intelligence.review.errRequired', 'This field is required'),
          });
        return;
      }
      if (isComplex) {
        try {
          JSON.parse(val);
        } catch {
          ctx.addIssue({
            code: 'custom',
            message: t('intelligence.review.errJson', 'Enter valid JSON'),
          });
        }
      } else if (isNumeric && Number.isNaN(Number(v))) {
        ctx.addIssue({
          code: 'custom',
          message: t('intelligence.review.errNumber', 'Enter a number'),
        });
      }
    });
  }
  return z.object({ fields: z.object(shape) });
}

/**
 * The Phase-1 review UI (docs/05 §6, HITL). Shows every extracted field with
 * its calibrated confidence, flags low-confidence / required-missing fields for
 * review, and lets the user correct values before the extraction is marked
 * human-validated. Field edits are validated (required / JSON / numeric) with
 * inline errors. Mount keyed by `extraction.id` so a reprocess re-seeds cleanly.
 */
export function ReviewExtraction({ extraction, sourceId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const save = useSaveReview(extraction.id, sourceId);
  const convert = useConvert();
  const reprocess = useReprocess(sourceId);
  const schemaOptions = useSchemaOptions();
  const [targetSchema, setTargetSchema] = useState('');

  const original = extraction.fields;

  const schema = useMemo(
    () => buildReviewSchema(t, extraction.schema.fields, original),
    // Rebuilt per extraction; t is stable enough for messages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extraction.id],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewValues>({
    resolver: zodResolver(schema) as unknown as Resolver<ReviewValues>,
    mode: 'onBlur',
    defaultValues: {
      fields: Object.fromEntries(
        extraction.schema.fields.map((f) => [f.key, toEditable(original[f.key])]),
      ),
    },
  });

  const isGeneric =
    !extraction.documentTypeKey || extraction.schema.key === GENERIC_SCHEMA_KEY;

  const flagged = useMemo(
    () => new Set(extraction.review.flaggedFields),
    [extraction.review.flaggedFields],
  );

  const collectPayload = (values: ReviewValues) => {
    const fields: Record<string, unknown> = {};
    const edits: { fieldPath: string; newValue: unknown }[] = [];
    for (const f of extraction.schema.fields) {
      const editedRaw = values.fields[f.key] ?? '';
      const coerced = fromEditable(editedRaw, original[f.key]);
      fields[f.key] = coerced;
      if (toEditable(original[f.key]) !== editedRaw) {
        edits.push({ fieldPath: f.key, newValue: coerced });
      }
    }
    return { fields, edits, markReviewed: true };
  };

  const onSave = handleSubmit(async (values) => {
    await save.mutateAsync(collectPayload(values));
  });

  // Save the corrected values first (so the document is built from them), then
  // convert to an editable Document and open it in the right editor.
  const onCreateDocument = handleSubmit(async (values) => {
    await save.mutateAsync(collectPayload(values));
    const res = await convert.mutateAsync(extraction.id);
    navigate(
      res.mode === 'structured'
        ? `/documents/${res.documentId}/edit`
        : `/documents/${res.documentId}/draft`,
    );
  });

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

      {/* Manual type override — config-driven from the resolver's schema list. */}
      <Card className={isGeneric ? 'border-warning/50' : undefined}>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">
                {t('intelligence.review.typeTitle', 'Document type')}
              </p>
              <p className="mt-0.5 text-xs text-foreground/60">
                {isGeneric
                  ? t(
                      'intelligence.review.typeGeneric',
                      'Detected as a generic / unknown document. Pick the correct type to re-extract it with that type’s fields.',
                    )
                  : t(
                      'intelligence.review.typeKnown',
                      'Detected as “{{name}}”. Re-process as a different type if that’s wrong.',
                      { name: extraction.schema.name },
                    )}
              </p>
            </div>
            {isGeneric && (
              <Badge variant="warning" outline>
                {t('intelligence.review.generic', 'Generic')}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={targetSchema} onValueChange={setTargetSchema}>
              <SelectTrigger className="w-64">
                <SelectValue
                  placeholder={t('intelligence.review.pickType', 'Choose a type…')}
                />
              </SelectTrigger>
              <SelectContent>
                {(schemaOptions.data ?? []).map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={isGeneric ? 'primary' : 'outline'}
              disabled={!targetSchema || reprocess.isPending || busy}
              onClick={() => reprocess.mutate(targetSchema)}
            >
              {reprocess.isPending
                ? t('intelligence.review.reprocessing', 'Re-processing…')
                : t('intelligence.review.reprocess', 'Re-process as type')}
            </Button>
          </div>
        </CardContent>
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
            const fieldError = errors.fields?.[field.key]?.message;

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
                    {field.required && <span className="ml-0.5 text-error">*</span>}
                  </label>
                  {field.description && (
                    <p className="text-xs text-foreground/50">{field.description}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Controller
                    control={control}
                    name={`fields.${field.key}`}
                    render={({ field: ctl }) =>
                      isComplex ? (
                        <Textarea
                          value={ctl.value ?? ''}
                          onChange={ctl.onChange}
                          onBlur={ctl.onBlur}
                          rows={3}
                          className="font-mono text-xs"
                          aria-invalid={!!fieldError}
                        />
                      ) : (
                        <Input
                          value={ctl.value ?? ''}
                          onChange={ctl.onChange}
                          onBlur={ctl.onBlur}
                          hasError={!!fieldError}
                          placeholder={
                            present
                              ? undefined
                              : t('intelligence.review.notFound', 'Not found')
                          }
                        />
                      )
                    }
                  />
                  {fieldError && (
                    <span role="alert" className="text-xs text-error">
                      {fieldError}
                    </span>
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
