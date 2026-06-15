import type { VaultEntityKind } from '@org/api-client';
import {
  Button,
  Card,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateVaultEntity } from './queries';
import { KIND_LABEL, KIND_ORDER } from './kinds';

/**
 * `/vault/new` — routed create page. Replaces the inline CreateDialog
 * so the create flow matches every other admin manager (citations,
 * schemas, pipelines, lookups): list → "+ New" routes to a dedicated
 * page, save routes back to list (or detail). Pre-fills `kind` from a
 * `?kind=` query param when the user clicked a kind-specific shortcut.
 */
export function VaultNewEntityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const create = useCreateVaultEntity();
  const initialKind = (params.get('kind') ?? 'person') as VaultEntityKind;
  const [kind, setKind] = useState<VaultEntityKind>(
    KIND_ORDER.includes(initialKind) ? initialKind : 'person',
  );
  const [label, setLabel] = useState('');

  const canSave = !!label.trim() && !create.isPending;

  const submit = async () => {
    if (!canSave) return;
    const entity = await create.mutateAsync({
      kind,
      label: label.trim(),
      fields: {},
    });
    // Land on the detail page so the user immediately sees their entity
    // — they can hit Edit from there to fill in the fields.
    navigate(`/vault/${entity.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('vault.newTitle', 'New vault entity')}
          </h1>
          <p className="mt-1 text-foreground/60">
            {t(
              'vault.newSubtitle',
              'Pick a type and a recognisable name. You can fill in the details next.',
            )}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/vault">{t('common.back', 'Back')}</Link>
        </Button>
      </div>

      <Card className="space-y-4 p-5">
        <FormField label={t('vault.kind', 'Type')}>
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as VaultEntityKind)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={t('vault.label', 'Name / label')}>
          <Input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t(
              'vault.labelPlaceholder',
              'e.g. Myself, Acme Pvt Ltd, Landlord Ramesh',
            )}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </FormField>

        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost">
            <Link to="/vault">{t('common.cancel', 'Cancel')}</Link>
          </Button>
          <Button onClick={submit} disabled={!canSave}>
            {create.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('vault.create', 'Create')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
