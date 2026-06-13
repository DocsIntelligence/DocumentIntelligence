import type { VaultEntityKind } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useNavigate } from 'react-router-dom';
import { useCreateVaultEntity, useVaultEntities } from './queries';

const KIND_LABEL: Record<VaultEntityKind, string> = {
  person: 'Person',
  company: 'Company',
  other: 'Other',
};

/** Document Vault — entities (person/company/…) and their saved details + docs. */
export function VaultPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useVaultEntities();
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('vault.title', 'Document Vault')}</h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'vault.subtitle',
              'Save people & companies once — their details and ID documents — then autofill any document. Sensitive fields are encrypted and masked.',
            )}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>{t('vault.new', 'New entity')}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('vault.empty', 'No saved entities yet. Add yourself, a company, or a counterparty.')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data?.map((e) => (
            <button
              key={e.id}
              onClick={() => navigate(`/vault/${e.id}`)}
              className="text-left"
            >
              <Card className="p-4 transition-colors hover:bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Badge variant={e.kind === 'company' ? 'secondary' : 'primary'}>
                    {KIND_LABEL[e.kind]}
                  </Badge>
                  <span className="truncate font-medium">{e.label}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {Object.values(e.fields).slice(0, 3).join(' · ') || t('vault.noFields', 'No details yet')}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('vault.docCount', '{{n}} document(s)', { n: e.documentCount })}
                </p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateVaultEntity();
  const [kind, setKind] = useState<VaultEntityKind>('person');
  const [label, setLabel] = useState('');

  const submit = async () => {
    if (!label.trim()) return;
    const entity = await create.mutateAsync({ kind, label: label.trim(), fields: {} });
    onClose();
    navigate(`/vault/${entity.id}`);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('vault.newTitle', 'New vault entity')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <FormField label={t('vault.kind', 'Type')}>
            <Select value={kind} onValueChange={(v) => setKind(v as VaultEntityKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="person">{t('vault.person', 'Person')}</SelectItem>
                <SelectItem value="company">{t('vault.company', 'Company')}</SelectItem>
                <SelectItem value="other">{t('vault.other', 'Other')}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('vault.label', 'Name / label')}>
            <Input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('vault.labelPlaceholder', 'e.g. Myself, Acme Pvt Ltd, Landlord Ramesh')}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={submit} disabled={!label.trim() || create.isPending}>
              {create.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('vault.create', 'Create')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
