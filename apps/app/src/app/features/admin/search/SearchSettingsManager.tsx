import { zodResolver } from '@hookform/resolvers/zod';
import type { SearchConfig, SearchKind } from '@org/api-client';
import { searchConfigSchema, type SearchConfigDto } from '@org/dto';
import { Button, FormField, Input, Spinner, Switch } from '@org/ui';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  useReindex,
  useSearchConfig,
  useUpdateSearchConfig,
} from '../../search/queries';

const ALL_KINDS: SearchKind[] = ['document', 'source'];

function SettingsForm({ config }: { config: SearchConfig }) {
  const { t } = useTranslation();
  const update = useUpdateSearchConfig();
  const reindex = useReindex();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<SearchConfigDto>({
    resolver: zodResolver(searchConfigSchema) as Resolver<SearchConfigDto>,
    defaultValues: {
      keywordWeight: config.keywordWeight,
      semanticWeight: config.semanticWeight,
      semanticEnabled: config.semanticEnabled,
      enabledKinds: config.enabledKinds,
      fuzzyThreshold: config.fuzzyThreshold,
      recencyWeight: config.recencyWeight,
      snippetWords: config.snippetWords,
      embeddingModel: config.embeddingModel,
      maxResults: config.maxResults,
    },
  });

  const enabledKinds = watch('enabledKinds') ?? [];
  const semanticEnabled = watch('semanticEnabled') ?? true;

  const toggleKind = (k: SearchKind) => {
    const next = enabledKinds.includes(k)
      ? enabledKinds.filter((x) => x !== k)
      : [...enabledKinds, k];
    setValue('enabledKinds', next, { shouldDirty: true });
  };

  const submit = handleSubmit((values) => update.mutate(values));

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label={t('searchAdmin.keywordWeight', 'Keyword weight (0–1)')}
          error={errors.keywordWeight?.message}
        >
          <Input
            type="number"
            step="0.05"
            {...register('keywordWeight', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('searchAdmin.semanticWeight', 'Semantic weight (0–1)')}
          error={errors.semanticWeight?.message}
        >
          <Input
            type="number"
            step="0.05"
            {...register('semanticWeight', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('searchAdmin.fuzzyThreshold', 'Fuzzy threshold (0–1)')}
          error={errors.fuzzyThreshold?.message}
        >
          <Input
            type="number"
            step="0.05"
            {...register('fuzzyThreshold', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('searchAdmin.recencyWeight', 'Recency weight (0–1)')}
          error={errors.recencyWeight?.message}
        >
          <Input
            type="number"
            step="0.05"
            {...register('recencyWeight', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('searchAdmin.snippetWords', 'Snippet length (words)')}
          error={errors.snippetWords?.message}
        >
          <Input
            type="number"
            {...register('snippetWords', { valueAsNumber: true })}
          />
        </FormField>
        <FormField
          label={t('searchAdmin.embeddingModel', 'Embedding model')}
          error={errors.embeddingModel?.message}
        >
          <Input {...register('embeddingModel')} />
        </FormField>
        <FormField
          label={t('searchAdmin.maxResults', 'Max results')}
          error={errors.maxResults?.message}
        >
          <Input
            type="number"
            {...register('maxResults', { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <span className="text-sm">
          <span className="font-medium">
            {t('searchAdmin.semanticEnabled', 'Semantic search')}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(
              'searchAdmin.semanticHint',
              'Use vector embeddings (pgvector) alongside keyword search. Requires an embedding-capable AI provider.',
            )}
          </span>
        </span>
        <Switch
          checked={semanticEnabled}
          onCheckedChange={(v) =>
            setValue('semanticEnabled', v, { shouldDirty: true })
          }
        />
      </label>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">
          {t('searchAdmin.enabledKinds', 'Searchable content')}
        </p>
        <div className="flex gap-4">
          {ALL_KINDS.map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabledKinds.includes(k)}
                onChange={() => toggleKind(k)}
              />
              {k === 'document'
                ? t('search.drafts', 'Drafts')
                : t('search.uploads', 'Uploads')}
            </label>
          ))}
        </div>
        {errors.enabledKinds && (
          <p className="mt-1 text-xs text-destructive">
            {errors.enabledKinds.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={update.isPending || !isDirty}>
          {update.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('common.save', 'Save')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => reindex.mutate()}
          disabled={reindex.isPending}
        >
          {reindex.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('searchAdmin.reindex', 'Rebuild index')}
        </Button>
      </div>
    </form>
  );
}

/** Admin manager for the org/system search configuration + index rebuild. */
export function SearchSettingsManager() {
  const { data, isLoading } = useSearchConfig();
  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  // Key on id so the form re-initialises if the underlying row changes.
  return <SettingsForm key={data.id} config={data} />;
}
