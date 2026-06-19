import type { VaultFieldDef } from '@org/api-client';
import { Badge, Button, Card, FormField, Input, Spinner } from '@org/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeader } from '../../components/page-header';
import { useVaultService } from '../documents/services-context';
import { useUpdateVaultEntity, useVaultEntity } from './queries';
import { FieldInput } from './FieldInput';
import { KIND_BADGE, KIND_LABEL } from './kinds';

/**
 * `/vault/:id/edit` — full editor for a vault entity. Reveals the
 * decrypted canonical fields on mount (audited via `svc.reveal`),
 * lets the user change the label + any field, and saves back. Splits
 * out of the detail page so the read/write flows are independent —
 * matches the SchemaEditor / CitationEditor pattern used elsewhere.
 */
export function VaultEntityEditPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const svc = useVaultService();
  const { data, isLoading } = useVaultEntity(id);
  const update = useUpdateVaultEntity(id);

  const [label, setLabel] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState(true);
  const [revealError, setRevealError] = useState<string | null>(null);

  // Group fields by their `group` for a tidy layout — identical to the
  // detail page so users see the same arrangement before and after.
  const groups = useMemo(() => {
    const m = new Map<string, VaultFieldDef[]>();
    for (const f of data?.schema ?? []) {
      const g = f.group ?? 'Details';
      const arr = m.get(g) ?? [];
      arr.push(f);
      m.set(g, arr);
    }
    return [...m.entries()];
  }, [data?.schema]);

  // Reveal the decrypted fields once the entity has loaded. The reveal
  // call writes a VaultAccessLog row, so it only fires when the user
  // actually lands on the edit page (not eagerly on the detail page).
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setLabel(data.label);
    setRevealing(true);
    svc
      .reveal(id)
      .then((revealed) => {
        if (cancelled) return;
        setForm({ ...revealed.fields });
        setRevealError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Reveal failed';
        setRevealError(msg);
        toast.error(t('vault.revealFailed', 'Could not reveal vault values'));
      })
      .finally(() => {
        if (!cancelled) setRevealing(false);
      });
    return () => {
      cancelled = true;
    };
    // svc and t are stable refs; only re-reveal if the entity id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data?.id]);

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const save = async () => {
    await update.mutateAsync({
      label: label.trim() || data.label,
      fields: form,
    });
    toast.success(t('vault.saved', 'Saved'));
    navigate(`/vault/${id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backTo={`/vault/${id}`}
        title={
          <span className="flex items-center gap-2">
            <Badge variant={KIND_BADGE[data.kind] ?? 'secondary'}>
              {KIND_LABEL[data.kind] ?? data.kind}
            </Badge>
            <span className="truncate">
              {t('vault.editTitle', 'Edit {{label}}', { label: data.label })}
            </span>
          </span>
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/vault/${id}`}>{t('common.cancel', 'Cancel')}</Link>
            </Button>
            <Button
              size="sm"
              onClick={save}
              disabled={update.isPending || revealing || !!revealError}
            >
              {update.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('common.save', 'Save')}
            </Button>
          </>
        }
      />

      <Card className="space-y-5 p-4">
        <FormField label={t('vault.label', 'Name / label')}>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t(
              'vault.labelPlaceholder',
              'e.g. Myself, Acme Pvt Ltd, Landlord Ramesh',
            )}
          />
        </FormField>

        {revealing && (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" />
            {t('vault.revealing', 'Decrypting fields…')}
          </div>
        )}
        {revealError && !revealing && (
          <div className="rounded-md border border-error/40 bg-error/5 p-4 text-sm text-error">
            {revealError}
          </div>
        )}

        {!revealing &&
          !revealError &&
          groups.map(([group, fields]) => (
            <div key={group} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((f) => (
                  <FormField
                    key={f.key}
                    label={f.label + (f.sensitive ? ' 🔒' : '')}
                  >
                    <FieldInput
                      def={f}
                      value={form[f.key] ?? ''}
                      onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                    />
                  </FormField>
                ))}
              </div>
            </div>
          ))}
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/vault/${id}`}>{t('common.cancel', 'Cancel')}</Link>
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={update.isPending || revealing || !!revealError}
        >
          {update.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('common.save', 'Save')}
        </Button>
      </div>
    </div>
  );
}
