import { Button, Card } from '@org/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCreateDocument, useDocumentCatalog } from './queries';

/**
 * Structured templates — promoted to a top-level page (/documents/templates)
 * instead of being buried at the bottom of the New-document picker. Browse the
 * document-type catalog, then pick a template to start a structured draft.
 */
export function TemplatesPage() {
  const { data: catalog, isLoading } = useDocumentCatalog();
  const { t } = useTranslation();
  const create = useCreateDocument();
  const navigate = useNavigate();
  const [typeKey, setTypeKey] = useState<string | null>(null);

  const selectedType = catalog?.find((c) => c.key === typeKey) ?? null;

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
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('templates.title', 'Templates')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'templates.subtitle',
            'Start from a structured document type — guided fields, the right format, and the applicable law filled in.',
          )}
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-foreground/60">
          {t('common.loading', 'Loading…')}
        </p>
      )}

      {!isLoading && !selectedType && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog?.map((ct) => (
            <button
              key={ct.key}
              type="button"
              onClick={() => setTypeKey(ct.key)}
              className="text-left"
            >
              <Card className="cursor-pointer space-y-2 rounded-xl p-5 transition-all hover:border-primary hover:shadow-md">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                  {ct.category}
                </span>
                <h3 className="font-semibold text-foreground">{ct.name}</h3>
                <p className="line-clamp-3 text-sm text-foreground/60">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {selectedType.templates.map((tpl) => (
              <Card key={tpl.key} className="space-y-3 rounded-xl p-5">
                <div>
                  <h4 className="font-semibold">{tpl.name}</h4>
                  <p className="mt-1 text-xs text-foreground/50">
                    {tpl.language.toUpperCase()} ·{' '}
                    {tpl.jurisdictions.join(', ')}
                  </p>
                </div>
                {tpl.isPremium && (
                  <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-900">
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
    </div>
  );
}

export default TemplatesPage;
