import { zodResolver } from '@hookform/resolvers/zod';
import { draftAiFormSchema, type DraftAiFormValues } from '@org/dto';
import { Button, Card, Label, Textarea } from '@org/ui';
import { cn } from '@org/utils';
import { useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DOCUMENT_PRESETS,
  type DocumentPreset,
  type DocumentPresetCategory,
} from '@org/legal-reference';
import { useCreateDocument } from './queries';
import { useLegalAiService } from './services-context';
import { warnCitations } from '../editor/DraftEditorPage';
import { DEFAULT_LANGUAGE, LanguageSelect } from '../../lib/languages';

const PRESET_CATEGORIES: DocumentPresetCategory[] = [
  'Court Filings',
  'Notices',
  'Agreements',
  'Personal',
  'Affidavits',
  'Information',
];

/**
 * Draft-with-AI as a dedicated page (was a modal inside the New-document
 * picker). Describe the document in plain English — or pick a preset to
 * pre-fill the brief — choose a language, and generate an editable draft.
 */
export function DraftWithAIPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateDocument();
  const legalAi = useLegalAiService();
  const [preset, setPreset] = useState<DocumentPreset | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DraftAiFormValues>({
    resolver: zodResolver(draftAiFormSchema) as Resolver<DraftAiFormValues>,
    defaultValues: { brief: '', language: DEFAULT_LANGUAGE },
    mode: 'onBlur',
  });
  const brief = watch('brief');

  function choosePreset(p: DocumentPreset) {
    setPreset(p);
    setValue('brief', p.sampleBrief ?? '', { shouldValidate: true });
  }

  const draft = handleSubmit(async (values) => {
    setBusy(true);
    try {
      const gen = await legalAi.generate({
        brief: values.brief,
        language: values.language,
        documentTypeKey: 'freeform',
        presetKey: preset?.key,
      });
      warnCitations(gen.citationWarnings);
      const doc = await create.mutateAsync({
        title: preset?.name ?? t('newDoc.aiDraftTitle', 'AI draft'),
        documentTypeKey: 'freeform',
        templateKey: 'freeform',
        data: { html: gen.html, values: {}, templateId: 'freeform' },
      });
      toast.success(t('newDoc.toastCreated', 'AI draft created'), {
        description: gen.disclaimer,
      });
      navigate(`/documents/${doc.id}/draft`);
    } catch {
      toast.error(
        t(
          'newDoc.toastError',
          'Could not draft with AI. Check your AI provider / quota.',
        ),
      );
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('dashboard.draftAiTitle', 'Draft with AI')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'newDoc.draftAiPageDesc',
            'Describe the document you need in plain English — or pick a starting point below.',
          )}
        </p>
      </div>

      <Card className="rounded-xl">
        <form onSubmit={draft} className="grid gap-2">
          <Label htmlFor="draft-ai-brief">
            {t('newDoc.briefLabel', 'Document description')}
          </Label>
          <Textarea
            id="draft-ai-brief"
            placeholder={t(
              'newDoc.briefPlaceholder',
              'e.g. "Legal notice to a tenant for unpaid rent of ₹60,000 over 3 months"',
            )}
            aria-invalid={!!errors.brief}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) draft();
            }}
            rows={5}
            {...register('brief')}
          />
          {errors.brief?.message && (
            <p role="alert" className="text-xs text-error">
              {errors.brief.message}
            </p>
          )}
          <Label htmlFor="draft-ai-language" className="mt-1">
            {t('settings.language', 'Language')}
          </Label>
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <LanguageSelect
                id="draft-ai-language"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </form>
        <div className="flex items-center justify-between gap-3">
          {preset ? (
            <span className="text-xs text-foreground/55">
              {t('newDoc.usingPreset', 'Starting from: {{name}}', {
                name: preset.name,
              })}
            </span>
          ) : (
            <span />
          )}
          <Button disabled={!brief.trim() || busy} onClick={draft}>
            {busy
              ? t('newDoc.drafting', 'Drafting…')
              : t('newDoc.generate', 'Generate')}
          </Button>
        </div>
      </Card>

      <div className="space-y-5">
        <div className="text-sm font-medium text-foreground/60">
          {t('newDoc.presetsHeading', 'Or pick a starting point')}
        </div>
        {PRESET_CATEGORIES.map((cat) => {
          const items = DOCUMENT_PRESETS.filter((p) => p.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                {t(`presetCategory.${cat}`, cat)}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => choosePreset(p)}
                    className={cn(
                      'group rounded-xl border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm',
                      preset?.key === p.key
                        ? 'border-primary/60 ring-1 ring-primary/30'
                        : 'border-border',
                    )}
                  >
                    <h4 className="font-semibold text-foreground group-hover:text-primary">
                      {p.name}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-xs text-foreground/55">
                      {p.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DraftWithAIPage;
