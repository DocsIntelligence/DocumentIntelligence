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
import { toast } from 'sonner';
import { useCreateDocument, useDocumentCatalog } from './queries';
import { useLegalAiService } from './services-context';
import { DEFAULT_LANGUAGE, LanguageSelect } from '../../lib/languages';

export function NewDocumentPicker() {
  const { data: catalog, isLoading } = useDocumentCatalog();
  const create = useCreateDocument();
  const navigate = useNavigate();
  const legalAi = useLegalAiService();
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [aiLanguage, setAiLanguage] = useState(DEFAULT_LANGUAGE);

  const selectedType = catalog?.find((t) => t.key === typeKey) ?? null;

  async function draftWithAI() {
    if (!aiBrief.trim()) return;
    setAiModalOpen(false);
    setAiBusy(true);
    try {
      const gen = await legalAi.generate({
        brief: aiBrief.trim(),
        language: aiLanguage,
        documentTypeKey: 'freeform',
      });
      const doc = await create.mutateAsync({
        title: 'AI draft',
        documentTypeKey: 'freeform',
        templateKey: 'freeform',
        data: { html: gen.html, values: {}, templateId: 'freeform' },
      });
      toast.success('AI draft created', { description: gen.disclaimer });
      navigate(`/documents/${doc.id}/draft`);
    } catch {
      toast.error('Could not draft with AI. Check your AI provider / quota.');
    } finally {
      setAiBusy(false);
    }
  }

  async function startWithTemplate(templateKey: string) {
    if (!selectedType) return;
    const doc = await create.mutateAsync({
      title: `Untitled ${selectedType.name}`,
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
        <h2 className="text-2xl font-semibold">New document</h2>
        <p className="text-foreground/60 mt-1">
          Draft freely with AI, or pick a structured document type below.
        </p>
      </div>

      {!typeKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="rounded-xl p-5 space-y-2 border-primary/30 bg-primary/5">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              AI
            </span>
            <h3 className="font-semibold text-foreground">Draft with AI</h3>
            <p className="text-sm text-foreground/60">
              Describe what you need in plain English and let AI draft the full
              document. Review and edit before use.
            </p>
            <Button
              isLoading={aiBusy}
              onClick={() => {
                setAiBrief('');
                setAiModalOpen(true);
              }}
              className="mt-1"
            >
              {aiBusy ? 'Drafting…' : 'Draft with AI'}
            </Button>
          </Card>
          <Card className="rounded-xl p-5 space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
              Freeform
            </span>
            <h3 className="font-semibold text-foreground">Blank document</h3>
            <p className="text-sm text-foreground/60">
              Open the rich-text editor and write from scratch, with
              transliteration, placeholders and page breaks.
            </p>
            <Button
              variant="outline"
              onClick={() => navigate('/editor')}
              className="mt-1"
            >
              Open editor
            </Button>
          </Card>
        </div>
      )}

      {!typeKey && (
        <div className="pt-2 text-sm font-medium text-foreground/60">
          Or start from a structured template
        </div>
      )}

      {isLoading && <p className="text-sm text-foreground/60">Loading…</p>}

      {!isLoading && !typeKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog?.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeKey(t.key)}
              className="text-left"
            >
              <Card className="rounded-xl p-5 hover:border-primary hover:shadow-md transition-all space-y-2 cursor-pointer">
                <span className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
                  {t.category}
                </span>
                <h3 className="font-semibold text-foreground">{t.name}</h3>
                <p className="text-sm text-foreground/60 line-clamp-3">
                  {t.description}
                </p>
                <p className="text-xs text-foreground/40">
                  {t.templates.length} template
                  {t.templates.length === 1 ? '' : 's'}
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
              {selectedType.name} — pick a template
            </h3>
            <Button variant="ghost" onClick={() => setTypeKey(null)}>
              Back
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
                    Premium
                  </span>
                )}
                <Button
                  disabled={create.isPending}
                  onClick={() => startWithTemplate(tpl.key)}
                >
                  {create.isPending ? 'Creating…' : 'Start with this template'}
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
            <DialogTitle>Draft with AI</DialogTitle>
            <DialogDescription>
              Describe the document you need in plain English. Be specific about
              parties, terms, and key details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-3">
            <Label htmlFor="new-doc-ai-brief">Document description</Label>
            <Textarea
              id="new-doc-ai-brief"
              placeholder='e.g. "Legal notice to a tenant for unpaid rent of ₹60,000 over 3 months"'
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
              Language
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
              Cancel
            </Button>
            <Button size="sm" disabled={!aiBrief.trim()} onClick={draftWithAI}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
