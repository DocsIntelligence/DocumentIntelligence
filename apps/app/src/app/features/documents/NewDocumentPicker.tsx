import { Button, Card } from '@org/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateDocument, useDocumentCatalog } from './queries';

export function NewDocumentPicker() {
  const { data: catalog, isLoading } = useDocumentCatalog();
  const create = useCreateDocument();
  const navigate = useNavigate();
  const [typeKey, setTypeKey] = useState<string | null>(null);

  const selectedType = catalog?.find((t) => t.key === typeKey) ?? null;

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
          Pick a document type, then choose a template style.
        </p>
      </div>

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
    </div>
  );
}
