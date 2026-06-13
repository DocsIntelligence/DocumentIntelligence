import type { VaultFieldConfig, VaultDocKindConfig } from '@org/api-client';
import {
  Badge,
  Button,
  Chip,
  DataTable,
  type DataTableColumn,
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
  Switch,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { EditIcon, IconButton, TrashIcon } from '../intelligence/icons';
import {
  useDeleteVaultDocKind,
  useDeleteVaultField,
  useUpsertVaultDocKind,
  useUpsertVaultField,
  useVaultDocKinds,
  useVaultFields,
} from './queries';

const KINDS = ['person', 'company', 'other'] as const;
const TYPES = ['text', 'textarea', 'date', 'number', 'tel', 'email', 'select', 'lookup'];

/** Admin manager for the configurable vault catalog (docs/10): fields per
 *  entity kind + document kinds. Edits the system defaults. */
export function VaultConfigManager() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const fields = useVaultFields();
  const docKinds = useVaultDocKinds();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('person');
  const [editField, setEditField] = useState<Partial<VaultFieldConfig> | null>(null);
  const [editDocKind, setEditDocKind] = useState<Partial<VaultDocKindConfig> | null>(null);
  const delField = useDeleteVaultField();
  const delDocKind = useDeleteVaultDocKind();

  const onDeleteField = async (r: VaultFieldConfig) => {
    const ok = await confirm({
      title: t('vaultAdmin.deleteFieldTitle', 'Delete this field?'),
      description: t(
        'vaultAdmin.deleteFieldDesc',
        'The field definition is removed from all entities of this type. Existing entity data is kept.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) delField.mutate(r.id);
  };

  const onDeleteDocKind = async (r: VaultDocKindConfig) => {
    const ok = await confirm({
      title: t('vaultAdmin.deleteDocKindTitle', 'Delete this document kind?'),
      description: t(
        'vaultAdmin.deleteDocKindDesc',
        'Existing documents of this kind are kept, but the kind will no longer be selectable.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) delDocKind.mutate(r.id);
  };

  const rows = (fields.data ?? []).filter((f) => f.entityKind === kind);

  const fieldColumns: DataTableColumn<VaultFieldConfig>[] = [
    {
      key: 'label',
      header: t('vaultAdmin.label', 'Label'),
      sortValue: (r) => r.label,
      cell: (r) => <span className="font-medium">{r.label}</span>,
    },
    {
      key: 'key',
      header: t('vaultAdmin.key', 'Key (stable)'),
      sortValue: (r) => r.key,
      cell: (r) => <code className="text-xs text-muted-foreground">{r.key}</code>,
    },
    {
      key: 'type',
      header: t('vaultAdmin.type', 'Type'),
      width: 'w-28',
      sortValue: (r) => r.type,
      cell: (r) => (
        <Badge variant="secondary" outline className="text-[10px]">
          {r.type === 'lookup' && r.lookupKey ? `lookup:${r.lookupKey}` : r.type}
        </Badge>
      ),
    },
    {
      key: 'group',
      header: t('vaultAdmin.group', 'Group'),
      width: 'w-28',
      sortValue: (r) => r.group ?? '',
      cell: (r) => r.group ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'sensitive',
      header: t('vaultAdmin.sensitive', 'Sensitive'),
      align: 'center',
      width: 'w-20',
      sortValue: (r) => (r.sensitive ? 1 : 0),
      cell: (r) =>
        r.sensitive ? (
          <span role="img" aria-label="sensitive">
            🔒
          </span>
        ) : null,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-20',
      pinned: true,
      cell: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={t('common.edit', 'Edit')}
            onClick={() => setEditField(r)}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            disabled={delField.isPending}
            onClick={() => onDeleteField(r)}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  const docKindColumns: DataTableColumn<VaultDocKindConfig>[] = [
    {
      key: 'label',
      header: t('vaultAdmin.label', 'Label'),
      sortValue: (r) => r.label,
      cell: (r) => <span className="font-medium">{r.label}</span>,
    },
    {
      key: 'kind',
      header: t('vaultAdmin.key', 'Key (stable)'),
      sortValue: (r) => r.kind,
      cell: (r) => <code className="text-xs text-muted-foreground">{r.kind}</code>,
    },
    {
      key: 'scannable',
      header: t('vaultAdmin.scannable', 'scannable'),
      align: 'center',
      width: 'w-24',
      sortValue: (r) => (r.scannable ? 1 : 0),
      cell: (r) =>
        r.scannable ? (
          <Badge variant="secondary" className="text-[10px]">
            {t('vaultAdmin.scannable', 'scannable')}
          </Badge>
        ) : null,
    },
    {
      key: 'fills',
      header: t('vaultAdmin.fills', 'Fills'),
      width: 'w-20',
      align: 'center',
      sortValue: (r) => r.fills.length,
      cell: (r) => r.fills.length,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 'w-20',
      pinned: true,
      cell: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={t('common.edit', 'Edit')}
            onClick={() => setEditDocKind(r)}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            disabled={delDocKind.isPending}
            onClick={() => onDeleteDocKind(r)}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Fields — table → edit (consistent with Document types & fields) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t('vaultAdmin.fields', 'Fields')}</h3>
          <Button size="sm" onClick={() => setEditField({ entityKind: kind, type: 'text' })}>
            {t('vaultAdmin.addField', 'Add field')}
          </Button>
        </div>
        {fields.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <DataTable
            tableId="admin.vault.fields"
            data={rows}
            columns={fieldColumns}
            rowKey={(r) => r.id}
            search={(r) => `${r.label} ${r.key} ${r.group ?? ''}`}
            searchPlaceholder={t('vaultAdmin.searchFields', 'Search fields…')}
            initialSort={{ key: 'label', dir: 'asc' }}
            empty={t('vaultAdmin.noFields', 'No fields for this type.')}
            toolbar={
              <div className="flex gap-2">
                {KINDS.map((k) => (
                  <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                    {k}
                  </Chip>
                ))}
              </div>
            }
          />
        )}
      </section>

      {/* Document kinds */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t('vaultAdmin.docKinds', 'Document kinds')}</h3>
          <Button size="sm" onClick={() => setEditDocKind({ scannable: true })}>
            {t('vaultAdmin.addDocKind', 'Add document kind')}
          </Button>
        </div>
        {docKinds.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <DataTable
            tableId="admin.vault.docKinds"
            data={docKinds.data ?? []}
            columns={docKindColumns}
            rowKey={(r) => r.id}
            search={(r) => `${r.label} ${r.kind}`}
            searchPlaceholder={t('vaultAdmin.searchDocKinds', 'Search document kinds…')}
            initialSort={{ key: 'label', dir: 'asc' }}
            empty={t('vaultAdmin.noDocKinds', 'No document kinds configured.')}
          />
        )}
      </section>

      {editField && (
        <FieldDialog
          initial={editField}
          onClose={() => setEditField(null)}
        />
      )}
      {editDocKind && (
        <DocKindDialog
          initial={editDocKind}
          allFields={fields.data ?? []}
          onClose={() => setEditDocKind(null)}
        />
      )}
    </div>
  );
}

function FieldDialog({
  initial,
  onClose,
}: {
  initial: Partial<VaultFieldConfig>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const upsert = useUpsertVaultField();
  const [f, setF] = useState({
    id: initial.id,
    entityKind: initial.entityKind ?? 'person',
    key: initial.key ?? '',
    label: initial.label ?? '',
    type: initial.type ?? 'text',
    group: initial.group ?? '',
    options: (initial.options ?? []).join(', '),
    lookupKey: initial.lookupKey ?? '',
    sensitive: initial.sensitive ?? false,
    revealLast: initial.revealLast ?? 0,
    placeholder: initial.placeholder ?? '',
    sortOrder: initial.sortOrder ?? 0,
    isActive: initial.isActive ?? true,
  });

  const save = async () => {
    if (!f.key.trim() || !f.label.trim()) return;
    await upsert.mutateAsync({
      id: f.id,
      entityKind: f.entityKind,
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type,
      group: f.group.trim() || null,
      options: f.options.split(',').map((s) => s.trim()).filter(Boolean),
      lookupKey: f.lookupKey.trim() || null,
      sensitive: f.sensitive,
      revealLast: f.revealLast || null,
      placeholder: f.placeholder.trim() || null,
      sortOrder: Number(f.sortOrder) || 0,
      isActive: f.isActive,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? t('vaultAdmin.editField', 'Edit field') : t('vaultAdmin.addField', 'Add field')}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('vaultAdmin.entityKind', 'Entity kind')}>
            <Select value={f.entityKind} onValueChange={(v) => setF((s) => ({ ...s, entityKind: v as VaultFieldConfig['entityKind'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('vaultAdmin.type', 'Type')}>
            <Select value={f.type} onValueChange={(v) => setF((s) => ({ ...s, type: v as VaultFieldConfig['type'] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => <SelectItem key={ty} value={ty}>{ty}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t('vaultAdmin.key', 'Key (stable)')}>
            <Input value={f.key} disabled={!!initial.id} onChange={(e) => setF((s) => ({ ...s, key: e.target.value }))} placeholder="aadhaar_number" />
          </FormField>
          <FormField label={t('vaultAdmin.label', 'Label')}>
            <Input value={f.label} onChange={(e) => setF((s) => ({ ...s, label: e.target.value }))} />
          </FormField>
          <FormField label={t('vaultAdmin.group', 'Group')}>
            <Input value={f.group} onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))} placeholder="Identity / Address / …" />
          </FormField>
          <FormField label={t('vaultAdmin.sortOrder', 'Order')}>
            <Input type="number" value={f.sortOrder} onChange={(e) => setF((s) => ({ ...s, sortOrder: Number(e.target.value) }))} />
          </FormField>
          {f.type === 'select' && (
            <FormField label={t('vaultAdmin.options', 'Options (comma-separated)')} className="col-span-2">
              <Input value={f.options} onChange={(e) => setF((s) => ({ ...s, options: e.target.value }))} />
            </FormField>
          )}
          {f.type === 'lookup' && (
            <FormField label={t('vaultAdmin.lookupKey', 'Lookup key (e.g. country, state)')} className="col-span-2">
              <Input value={f.lookupKey} onChange={(e) => setF((s) => ({ ...s, lookupKey: e.target.value }))} placeholder="country" />
            </FormField>
          )}
          <label className="col-span-2 flex items-center justify-between rounded-md border p-2 text-sm">
            <span>{t('vaultAdmin.sensitive', 'Sensitive (encrypted + masked)')}</span>
            <Switch checked={f.sensitive} onCheckedChange={(v) => setF((s) => ({ ...s, sensitive: v }))} />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={save} disabled={upsert.isPending || !f.key.trim() || !f.label.trim()}>
            {upsert.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('common.save', 'Save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocKindDialog({
  initial,
  allFields,
  onClose,
}: {
  initial: Partial<VaultDocKindConfig>;
  allFields: VaultFieldConfig[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const upsert = useUpsertVaultDocKind();
  const [d, setD] = useState({
    id: initial.id,
    kind: initial.kind ?? '',
    label: initial.label ?? '',
    fills: (initial.fills ?? []).join(', '),
    scannable: initial.scannable ?? true,
    sortOrder: initial.sortOrder ?? 0,
    isActive: initial.isActive ?? true,
  });
  const knownKeys = [...new Set(allFields.map((f) => f.key))];

  const save = async () => {
    if (!d.kind.trim() || !d.label.trim()) return;
    await upsert.mutateAsync({
      id: d.id,
      kind: d.kind.trim(),
      label: d.label.trim(),
      fills: d.fills.split(',').map((s) => s.trim()).filter(Boolean),
      scannable: d.scannable,
      sortOrder: Number(d.sortOrder) || 0,
      isActive: d.isActive,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? t('vaultAdmin.editDocKind', 'Edit document kind') : t('vaultAdmin.addDocKind', 'Add document kind')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('vaultAdmin.key', 'Key (stable)')}>
              <Input value={d.kind} disabled={!!initial.id} onChange={(e) => setD((s) => ({ ...s, kind: e.target.value }))} placeholder="aadhaar" />
            </FormField>
            <FormField label={t('vaultAdmin.label', 'Label')}>
              <Input value={d.label} onChange={(e) => setD((s) => ({ ...s, label: e.target.value }))} />
            </FormField>
          </div>
          <FormField label={t('vaultAdmin.fills', 'Fills (canonical keys, comma-separated)')}>
            <Input value={d.fills} onChange={(e) => setD((s) => ({ ...s, fills: e.target.value }))} placeholder="full_name, aadhaar_number, dob" />
          </FormField>
          <p className="text-xs text-muted-foreground">
            {t('vaultAdmin.knownKeys', 'Known keys')}: {knownKeys.join(', ')}
          </p>
          <label className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span>{t('vaultAdmin.scannableLabel', 'Scannable (OCR autofill)')}</span>
            <Switch checked={d.scannable} onCheckedChange={(v) => setD((s) => ({ ...s, scannable: v }))} />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel', 'Cancel')}</Button>
          <Button onClick={save} disabled={upsert.isPending || !d.kind.trim() || !d.label.trim()}>
            {upsert.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('common.save', 'Save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
