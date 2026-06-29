import { Button, Card, Chip, Input } from '@org/ui';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/page-header';
import { useTranslation } from 'react-i18next';
import { useCreateDocument, useDocumentCatalog } from './queries';

/**
 * Structured templates — promoted to a top-level page (/documents/templates)
 * instead of being buried at the bottom of the New-document picker. Browse the
 * document-type catalog (with search + category filter), then pick a template
 * to start a structured draft.
 */
export function TemplatesPage() {
  const { data: catalog, isLoading } = useDocumentCatalog();
  const { t } = useTranslation();
  const create = useCreateDocument();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const [typeKey, setTypeKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const selectedType = catalog?.find((c) => c.key === typeKey) ?? null;

  const categories = useMemo(() => {
    const set = new Set((catalog ?? []).map((c) => c.category).filter(Boolean));
    return [...set].sort();
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog ?? []).filter((c) => {
      if (category && c.category !== category) return false;
      if (!q) return true;
      return [c.name, c.description, c.category]
        .filter((s): s is string => !!s)
        .some((s) => s.toLowerCase().includes(q));
    });
  }, [catalog, query, category]);

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
      groupId,
    });
    navigate(`/documents/${doc.id}/edit`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={false}
        title={t('templates.title', 'Templates')}
        subtitle={t(
          'templates.subtitle',
          'Start from a structured document type — guided fields, the right format, and the applicable law filled in.',
        )}
      />

      {isLoading && (
        <p className="text-sm text-foreground/60">
          {t('common.loading', 'Loading…')}
        </p>
      )}

      {!isLoading && !selectedType && (
        <>
          <div className="space-y-3">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(
                'templates.searchPlaceholder',
                'Search templates (e.g. rent, NDA, affidavit)…',
              )}
              aria-label={t('templates.searchLabel', 'Search templates')}
            />
            {categories.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <Chip
                  active={category === null}
                  onClick={() => setCategory(null)}
                >
                  {t('templates.allCategories', 'All')}
                </Chip>
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    active={category === cat}
                    onClick={() => setCategory(cat)}
                    className="capitalize"
                  >
                    {cat}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-foreground/50">
              {t('templates.noResults', 'No templates match your search.')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ct) => (
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
        </>
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
                  <span className="inline-block rounded-full bg-warning/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-warning">
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
