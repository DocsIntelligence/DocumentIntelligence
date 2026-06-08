import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@org/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  DOCUMENT_PRESETS,
  type DocumentPreset,
  type DocumentPresetCategory,
} from '@org/legal-reference';
import { useCreateDocument, useDocumentCatalog } from './queries';
import { useLegalAiService } from './services-context';
import { DEFAULT_LANGUAGE, LanguageSelect } from '../../lib/languages';

const PRESET_CATEGORIES: DocumentPresetCategory[] = [
  'Court Filings',
  'Notices',
  'Agreements',
  'Personal',
  'Affidavits',
  'Information',
];

export function NewDocumentPicker() {
  const { data: catalog, isLoading } = useDocumentCatalog();
  const { t } = useTranslation();
  const create = useCreateDocument();
  const navigate = useNavigate();
  const legalAi = useLegalAiService();
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiLanguage, setAiLanguage] = useState(DEFAULT_LANGUAGE);
  const [preset, setPreset] = useState<DocumentPreset | null>(null);

  const selectedType = catalog?.find((t) => t.key === typeKey) ?? null;

  function openAiModal(p: DocumentPreset | null) {
    setPreset(p);
    setAiBrief(p?.sampleBrief ?? '');
    setAiModalOpen(true);
  }

  async function draftWithAI() {
    if (!aiBrief.trim()) return;
    setAiModalOpen(false);
    setAiBusy(true);
    try {
      const gen = await legalAi.generate({
        brief: aiBrief.trim(),
        language: aiLanguage,
        documentTypeKey: 'freeform',
        presetKey: preset?.key,
      });
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
      setAiBusy(false);
    }
  }

  async function startWithTemplate(templateKey: string) {
    if (!selectedType) return;
    const doc = await create.mutateAsync({
      title: t('newDoc.untitledType', 'Untitled {{name}}', {
        name: selectedType.name,
      }),
      documentTypeKey: selectedType.key,
      templateKey,
      pageSize: selectedType.defaultPageSize,
      data: {},
    });
    navigate(`/documents/${doc.id}/edit`);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-semibold">
          {t('common.newDocument', 'New document')}
        </h2>
        <p className="text-foreground/60 mt-1">
          {t(
            'newDoc.subtitle',
            'Draft freely with AI, or pick a structured document type below.',
          )}
        </p>
      </div>

      {!typeKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-xl p-5 space-y-2 border-primary/30 bg-primary/5">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              AI
            </span>
            <h3 className="font-semibold text-foreground">
              {t('dashboard.draftAiTitle', 'Draft with AI')}
            </h3>
            <p className="text-sm text-foreground/60">
              {t(
                'newDoc.draftAiCardDesc',
                'Describe what you need in plain English and let AI draft the full document. Review and edit before use.',
              )}
            </p>
            <Button
              isLoading={aiBusy}
              onClick={() => openAiModal(null)}
              className="mt-1"
            >
              {aiBusy
                ? t('newDoc.drafting', 'Drafting…')
                : t('dashboard.draftAiTitle', 'Draft with AI')}
            </Button>
          </Card>
          <Card className="rounded-xl p-5 space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              {t('newDoc.freeformBadge', 'Freeform')}
            </span>
            <h3 className="font-semibold text-foreground">
              {t('newDoc.blankTitle', 'Blank document')}
            </h3>
            <p className="text-sm text-foreground/60">
              {t(
                'newDoc.blankCardDesc',
                'Open the rich-text editor and write from scratch, with transliteration, placeholders and page breaks.',
              )}
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('/editor')}
              className="mt-1"
            >
              {t('newDoc.openEditor', 'Open editor')}
            </Button>
          </Card>
        </div>
      )}

      {!typeKey && (
        <div className="space-y-5">
          <div className="pt-2 text-sm font-medium text-foreground/60">
            {t(
              'newDoc.presetsHeading',
              'Draft any document with AI — pick a starting point',
            )}
          </div>
          {PRESET_CATEGORIES.map((cat) => {
            const items = DOCUMENT_PRESETS.filter((p) => p.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/45">
                  {t(`presetCategory.${cat}`, cat)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => openAiModal(p)}
                      className="group rounded-xl border border-border bg-background p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                    >
                      <h4 className="font-semibold text-foreground group-hover:text-primary">
                        {p.name}
                      </h4>
                      <p className="mt-1 text-xs text-foreground/55 line-clamp-2">
                        {p.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!typeKey && (
        <div className="pt-2 text-sm font-medium text-foreground/60">
          {t('newDoc.orStructured', 'Or start from a structured template')}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-foreground/60">
          {t('common.loading', 'Loading…')}
        </p>
      )}

      {!isLoading && !typeKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog?.map((ct) => (
            <button
              key={ct.key}
              type="button"
              onClick={() => setTypeKey(ct.key)}
              className="text-left"
            >
              <Card className="rounded-xl p-5 hover:border-primary hover:shadow-md transition-all space-y-2 cursor-pointer">
                <span className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
                  {ct.category}
                </span>
                <h3 className="font-semibold text-foreground">{ct.name}</h3>
                <p className="text-sm text-foreground/60 line-clamp-3">
                  {ct.description}
                </p>
                <p className="text-xs text-foreground/40">
                  {t('newDoc.templateCount', '{{count}} template', {
                    count: ct.templates.length,
                  })}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selectedType && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">
              {t('newDoc.pickTemplate', '{{name}} — pick a template', {
                name: selectedType.name,
              })}
            </h3>
            <Button variant="ghost" onClick={() => setTypeKey(null)}>
              {t('common.back', 'Back')}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedType.templates.map((tpl) => (
              <Card key={tpl.key} className="rounded-xl p-5 space-y-3">
                <div>
                  <h4 className="font-semibold">{tpl.name}</h4>
                  <p className="text-xs text-foreground/50 mt-1">
                    {tpl.language.toUpperCase()} ·{' '}
                    {tpl.jurisdictions.join(', ')}
                  </p>
                </div>
                {tpl.isPremium && (
                  <span className="inline-block text-[10px] uppercase tracking-wide bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                    {t('newDoc.premium', 'Premium')}
                  </span>
                )}
                <Button
                  disabled={create.isPending}
                  onClick={() => startWithTemplate(tpl.key)}
                >
                  {create.isPending
                    ? t('newDoc.creating', 'Creating…')
                    : t('newDoc.startTemplate', 'Start with this template')}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* AI Draft Modal */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {preset ? preset.name : t('dashboard.draftAiTitle', 'Draft with AI')}
            </DialogTitle>
            <DialogDescription>
              {preset
                ? t(
                    'newDoc.modalDescPreset',
                    'Fill in the details below (replace the placeholder tokens), then generate. You can refine and translate it in the editor.',
                  )
                : t(
                    'newDoc.modalDescFree',
                    'Describe the document you need in plain English. Be specific about parties, terms, and key details.',
                  )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="new-doc-ai-brief">
              {t('newDoc.briefLabel', 'Document description')}
            </Label>
            <Textarea
              id="new-doc-ai-brief"
              placeholder={t(
                'newDoc.briefPlaceholder',
                'e.g. "Legal notice to a tenant for unpaid rent of ₹60,000 over 3 months"',
              )}
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  draftWithAI();
                }
              }}
              rows={4}
              autoFocus
            />
            <Label htmlFor="new-doc-ai-language" className="mt-1">
              {t('settings.language', 'Language')}
            </Label>
            <LanguageSelect
              id="new-doc-ai-language"
              value={aiLanguage}
              onChange={setAiLanguage}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiModalOpen(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button size="sm" disabled={!aiBrief.trim()} onClick={draftWithAI}>
              {t('newDoc.generate', 'Generate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
