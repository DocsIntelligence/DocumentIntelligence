import {
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVaultService } from '../documents/services-context';
import { useVaultEntities } from './queries';
import { KIND_BADGE, KIND_LABEL } from './kinds';

/**
 * Pick a vault entity to autofill a document section. On pick, fetches the
 * entity's decrypted canonical fields (audited) and hands them back to the
 * caller, which maps them onto the section's form fields.
 */
export function VaultAutofillDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (fields: Record<string, string>, label: string) => void;
}) {
  const { t } = useTranslation();
  const svc = useVaultService();
  const [q, setQ] = useState('');
  const { data, isLoading } = useVaultEntities({ q: q || undefined, pageSize: 50 });
  const entities = (data?.items ?? []).filter((e) => e.isActive);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pick = async (id: string, label: string) => {
    setBusyId(id);
    try {
      const res = await svc.autofill(id);
      onPick(res.fields, label);
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('vault.insertTitle', 'Insert from vault')}</DialogTitle>
        </DialogHeader>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('vault.search', 'Search entities…')}
          className="mb-2"
        />
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : entities.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t('vault.insertEmpty', 'No saved entities yet. Add one in the Vault first.')}
          </p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {entities.map((e) => (
              <button
                key={e.id}
                onClick={() => pick(e.id, e.label)}
                disabled={busyId !== null}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
              >
                <Badge variant={KIND_BADGE[e.kind] ?? 'secondary'}>
                  {KIND_LABEL[e.kind] ?? e.kind}
                </Badge>
                <span className="flex-1 truncate">{e.label}</span>
                {busyId === e.id && <Spinner className="h-4 w-4" />}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
