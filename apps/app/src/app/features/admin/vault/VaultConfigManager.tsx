import type { VaultFieldConfig, VaultDocKindConfig } from '@org/api-client';
import {
  Badge,
  Button,
  DataTable,
  type DataTableColumn,
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
import { cn } from '@org/utils';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { EditIcon, IconButton, TrashIcon } from '../intelligence/icons';
import { KIND_LABEL, KIND_ORDER } from '../../vault/kinds';
import {
  useDeleteVaultDocKind,
  useDeleteVaultField,
  useUpsertVaultDocKind,
  useUpsertVaultField,
  useVaultDocKinds,
  useVaultFields,
} from './queries';

export const VAULT_KINDS = KIND_ORDER;
const TYPES = ['text', 'textarea', 'date', 'number', 'tel', 'email', 'select', 'lookup'];

/**
 * Shared tab strip — Fields | Document kinds. Each tab is its own route so
 * the sidebar entry deep-links cleanly and the URL is shareable. Mirrors
 * the pattern used by Doc-Types / Pipelines / Lookups (separate routes,
 * never two stacked tables on one page).
 */
function VaultConfigTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tabs = [
    { to: '/admin/intelligence/vault', label: t('vaultAdmin.fields', 'Fields') },
    {
      to: '/admin/intelligence/vault/doc-kinds',
      label: t('vaultAdmin.docKinds', 'Document kinds'),
    },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border pb-1">
      {tabs.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-foreground'
                : 'text-foreground/55 hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Small stat tile, same shape as SchemaManager's. */
function StatTile({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'muted' | 'info';
}) {
  const toneClass = {
    default: 'bg-secondary/60 text-foreground',
    success: 'bg-success/10 text-success',
    muted: 'bg-secondary/40 text-foreground/55',
    info: 'bg-info/10 text-info',
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-foreground/55">{label}</p>
      <p
        className={cn(
          'mt-1 inline-flex rounded-md px-2 py-0.5 text-lg font-semibold tabular-nums',
          toneClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Fields manager — primary tab. Lists all configured fields with kind +
 *  status filtering, edits via routed pages. Matches the SchemaManager
 *  visual: stat tiles + DataTable + filter chips for the entity kind. */
export function VaultFieldsManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const fields = useVaultFields();
  const delField = useDeleteVaultField();
  const [kind, setKind] = useState<(typeof VAULT_KINDS)[number]>('person');

  const openField = (id: string) =>
    navigate(`/admin/intelligence/vault/fields/${encodeURIComponent(id)}/edit`);
  const newField = () =>
    navigate(`/admin/intelligence/vault/fields/new?kind=${encodeURIComponent(kind)}`);

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

  const rows = (fields.data ?? []).filter((f) => f.entityKind === kind);
  const totalFields = fields.data?.length ?? 0;
  const sensitiveCount = useMemo(
    () => (fields.data ?? []).filter((f) => f.sensitive).length,
    [fields.data],
  );
  const lookupCount = useMemo(
    () => (fields.data ?? []).filter((f) => f.type === 'lookup').length,
    [fields.data],
  );

  const fieldColumns: DataTableColumn<VaultFieldConfig>[] = [
    {
      key: 'label',
      header: t('vaultAdmin.label', 'Label'),
      sortValue: (r) => r.label,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.label}</p>
          <p className="truncate font-mono text-xs text-foreground/45">
            {r.key}
          </p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('vaultAdmin.type', 'Type'),
      width: 'w-28',
      sortValue: (r) => r.type,
      cell: (r) => (
        <Badge variant="secondary" outline className="text-[10px]">
          {r.type === 'lookup' && r.lookupKey
            ? `lookup:${r.lookupKey}`
            : r.type}
        </Badge>
      ),
    },
    {
      key: 'group',
      header: t('vaultAdmin.group', 'Group'),
      width: 'w-32',
      sortValue: (r) => r.group ?? '',
      cell: (r) =>
        r.group ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'sensitive',
      header: t('vaultAdmin.sensitive', 'Sensitive'),
      align: 'center',
      width: 'w-24',
      sortValue: (r) => (r.sensitive ? 1 : 0),
      cell: (r) =>
        r.sensitive ? (
          <Badge variant="warning" className="text-[10px]">
            {t('vaultAdmin.sensitiveTag', 'Encrypted')}
          </Badge>
        ) : null,
    },
    {
      key: 'sortOrder',
      header: t('vaultAdmin.sortOrder', 'Order'),
      align: 'right',
      width: 'w-16',
      sortValue: (r) => r.sortOrder,
      cell: (r) => <span className="tabular-nums">{r.sortOrder}</span>,
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
            onClick={() => openField(r.id)}
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

  return (
    <div className="space-y-5">
      <VaultConfigTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t('vaultAdmin.totalFields', 'Total fields')}
          value={totalFields}
        />
        <StatTile
          label={t('vaultAdmin.currentKind', '{{kind}} fields', {
            kind: KIND_LABEL[kind],
          })}
          value={rows.length}
          tone="info"
        />
        <StatTile
          label={t('vaultAdmin.sensitiveCount', 'Encrypted')}
          value={sensitiveCount}
          tone="success"
        />
        <StatTile
          label={t('vaultAdmin.lookupCount', 'Lookups')}
          value={lookupCount}
          tone="muted"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t('vaultAdmin.fieldsHeading', 'Fields for {{kind}}', {
              kind: KIND_LABEL[kind],
            })}
          </h3>
          <p className="mt-0.5 text-xs text-foreground/55">
            {t(
              'vaultAdmin.fieldsHint',
              'Canonical keys stay stable so document autofill keeps working.',
            )}
          </p>
        </div>
        <Button onClick={newField}>
          {t('vaultAdmin.addField', '+ Add field')}
        </Button>
      </div>

      {fields.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-secondary/40"
            />
          ))}
        </div>
      ) : (
        <DataTable
          tableId="admin.vault.fields"
          data={rows}
          columns={fieldColumns}
          rowKey={(r) => r.id}
          search={(r) => `${r.label} ${r.key} ${r.group ?? ''}`}
          searchPlaceholder={t('vaultAdmin.searchFields', 'Search fields…')}
          initialSort={{ key: 'sortOrder', dir: 'asc' }}
          empty={t(
            'vaultAdmin.noFields',
            'No fields for this type yet. Click "+ Add field" to define one.',
          )}
          toolbar={
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/55">
                {t('vaultAdmin.entityKind', 'Type')}
              </span>
              <Select
                value={kind}
                onValueChange={(v) =>
                  setKind(v as (typeof VAULT_KINDS)[number])
                }
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAULT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        />
      )}
    </div>
  );
}

/** Doc-kinds manager — secondary tab. Lists the document kinds (PAN /
 *  Aadhaar / Sale deed etc.) the Vault knows about. Editing routes to
 *  its own form page, so this stays a single-purpose table view. */
export function VaultDocKindsManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const docKinds = useVaultDocKinds();
  const delDocKind = useDeleteVaultDocKind();

  const openDocKind = (id: string) =>
    navigate(
      `/admin/intelligence/vault/doc-kinds/${encodeURIComponent(id)}/edit`,
    );
  const newDocKind = () => navigate('/admin/intelligence/vault/doc-kinds/new');

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

  const all = docKinds.data ?? [];
  const scannableCount = all.filter((k) => k.scannable).length;

  const docKindColumns: DataTableColumn<VaultDocKindConfig>[] = [
    {
      key: 'label',
      header: t('vaultAdmin.label', 'Label'),
      sortValue: (r) => r.label,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.label}</p>
          <p className="truncate font-mono text-xs text-foreground/45">
            {r.kind}
          </p>
        </div>
      ),
    },
    {
      key: 'scannable',
      header: t('vaultAdmin.scanCol', 'Scan'),
      align: 'center',
      width: 'w-28',
      sortValue: (r) => (r.scannable ? 1 : 0),
      cell: (r) =>
        r.scannable ? (
          <Badge variant="success" className="text-[10px]">
            {t('vaultAdmin.scannable', 'scannable')}
          </Badge>
        ) : (
          <Badge variant="secondary" outline className="text-[10px]">
            {t('vaultAdmin.notScannable', 'attach only')}
          </Badge>
        ),
    },
    {
      key: 'fills',
      header: t('vaultAdmin.fills', 'Fills'),
      width: 'w-20',
      align: 'center',
      sortValue: (r) => r.fills.length,
      cell: (r) => <span className="tabular-nums">{r.fills.length}</span>,
    },
    {
      key: 'sortOrder',
      header: t('vaultAdmin.sortOrder', 'Order'),
      align: 'right',
      width: 'w-16',
      sortValue: (r) => r.sortOrder,
      cell: (r) => <span className="tabular-nums">{r.sortOrder}</span>,
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
            onClick={() => openDocKind(r.id)}
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
    <div className="space-y-5">
      <VaultConfigTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t('vaultAdmin.totalDocKinds', 'Total kinds')}
          value={all.length}
        />
        <StatTile
          label={t('vaultAdmin.scannableTile', 'Scannable')}
          value={scannableCount}
          tone="success"
        />
        <StatTile
          label={t('vaultAdmin.attachOnly', 'Attach only')}
          value={all.length - scannableCount}
          tone="muted"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t('vaultAdmin.docKindsHeading', 'Document kinds')}
          </h3>
          <p className="mt-0.5 text-xs text-foreground/55">
            {t(
              'vaultAdmin.docKindsHint',
              'Each scannable kind defines which canonical fields it autofills on OCR.',
            )}
          </p>
        </div>
        <Button onClick={newDocKind}>
          {t('vaultAdmin.addDocKind', '+ Add document kind')}
        </Button>
      </div>

      {docKinds.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-lg bg-secondary/40"
            />
          ))}
        </div>
      ) : (
        <DataTable
          tableId="admin.vault.docKinds"
          data={all}
          columns={docKindColumns}
          rowKey={(r) => r.id}
          search={(r) => `${r.label} ${r.kind}`}
          searchPlaceholder={t(
            'vaultAdmin.searchDocKinds',
            'Search document kinds…',
          )}
          initialSort={{ key: 'sortOrder', dir: 'asc' }}
          empty={t(
            'vaultAdmin.noDocKinds',
            'No document kinds configured. Click "+ Add document kind" to define one.',
          )}
        />
      )}
    </div>
  );
}

/**
 * Legacy export. Original page rendered both managers stacked vertically;
 * routes now point at the sub-managers individually. Kept as a one-line
 * passthrough so any external imports still compile during the transition.
 */
export function VaultConfigManager() {
  return <VaultFieldsManager />;
}

/** Field editor — used by both new/edit routed pages. */
export function VaultFieldForm({
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
      options: f.options
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('common.back', 'Back to vault config')}
        </Button>
        <Button
          onClick={save}
          disabled={upsert.isPending || !f.key.trim() || !f.label.trim()}
        >
          {upsert.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('common.save', 'Save')}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('vaultAdmin.entityKind', 'Entity kind')}>
          <Select
            value={f.entityKind}
            onValueChange={(v) =>
              setF((s) => ({
                ...s,
                entityKind: v as VaultFieldConfig['entityKind'],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAULT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={t('vaultAdmin.type', 'Type')}>
          <Select
            value={f.type}
            onValueChange={(v) =>
              setF((s) => ({ ...s, type: v as VaultFieldConfig['type'] }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((ty) => (
                <SelectItem key={ty} value={ty}>
                  {ty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={t('vaultAdmin.key', 'Key (stable)')}>
          <Input
            value={f.key}
            disabled={!!initial.id}
            onChange={(e) => setF((s) => ({ ...s, key: e.target.value }))}
            placeholder="aadhaar_number"
          />
        </FormField>
        <FormField label={t('vaultAdmin.label', 'Label')}>
          <Input
            value={f.label}
            onChange={(e) => setF((s) => ({ ...s, label: e.target.value }))}
          />
        </FormField>
        <FormField label={t('vaultAdmin.group', 'Group')}>
          <Input
            value={f.group}
            onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}
            placeholder="Identity / Address / …"
          />
        </FormField>
        <FormField label={t('vaultAdmin.sortOrder', 'Order')}>
          <Input
            type="number"
            value={f.sortOrder}
            onChange={(e) =>
              setF((s) => ({ ...s, sortOrder: Number(e.target.value) }))
            }
          />
        </FormField>
        <FormField
          label={t('vaultAdmin.placeholder', 'Placeholder (optional)')}
          className="sm:col-span-2"
        >
          <Input
            value={f.placeholder}
            onChange={(e) =>
              setF((s) => ({ ...s, placeholder: e.target.value }))
            }
            placeholder="e.g. ABCDE1234F"
          />
        </FormField>
        {f.type === 'select' && (
          <FormField
            label={t('vaultAdmin.options', 'Options (comma-separated)')}
            className="sm:col-span-2"
          >
            <Input
              value={f.options}
              onChange={(e) =>
                setF((s) => ({ ...s, options: e.target.value }))
              }
            />
          </FormField>
        )}
        {f.type === 'lookup' && (
          <FormField
            label={t(
              'vaultAdmin.lookupKey',
              'Lookup key (e.g. country, state)',
            )}
            className="sm:col-span-2"
          >
            <Input
              value={f.lookupKey}
              onChange={(e) =>
                setF((s) => ({ ...s, lookupKey: e.target.value }))
              }
              placeholder="country"
            />
          </FormField>
        )}
        <label className="flex items-center justify-between rounded-md border p-2 text-sm sm:col-span-2">
          <span>
            {t('vaultAdmin.sensitive', 'Sensitive (encrypted + masked)')}
          </span>
          <Switch
            checked={f.sensitive}
            onCheckedChange={(v) => setF((s) => ({ ...s, sensitive: v }))}
          />
        </label>
      </div>
    </div>
  );
}

/** Doc-kind editor — used by both new/edit routed pages. */
export function VaultDocKindForm({
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
      fills: d.fills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      scannable: d.scannable,
      sortOrder: Number(d.sortOrder) || 0,
      isActive: d.isActive,
    });
    onClose();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('common.back', 'Back to vault config')}
        </Button>
        <Button
          onClick={save}
          disabled={upsert.isPending || !d.kind.trim() || !d.label.trim()}
        >
          {upsert.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('common.save', 'Save')}
        </Button>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t('vaultAdmin.key', 'Key (stable)')}>
            <Input
              value={d.kind}
              disabled={!!initial.id}
              onChange={(e) => setD((s) => ({ ...s, kind: e.target.value }))}
              placeholder="aadhaar"
            />
          </FormField>
          <FormField label={t('vaultAdmin.label', 'Label')}>
            <Input
              value={d.label}
              onChange={(e) => setD((s) => ({ ...s, label: e.target.value }))}
            />
          </FormField>
          <FormField label={t('vaultAdmin.sortOrder', 'Order')}>
            <Input
              type="number"
              value={d.sortOrder}
              onChange={(e) =>
                setD((s) => ({ ...s, sortOrder: Number(e.target.value) }))
              }
            />
          </FormField>
        </div>
        <FormField
          label={t(
            'vaultAdmin.fills',
            'Fills (canonical keys, comma-separated)',
          )}
        >
          <Input
            value={d.fills}
            onChange={(e) => setD((s) => ({ ...s, fills: e.target.value }))}
            placeholder="full_name, aadhaar_number, dob"
          />
        </FormField>
        <p className="text-xs text-muted-foreground">
          {t('vaultAdmin.knownKeys', 'Known keys')}: {knownKeys.join(', ')}
        </p>
        <label className="flex items-center justify-between rounded-md border p-2 text-sm">
          <span>{t('vaultAdmin.scannableLabel', 'Scannable (OCR autofill)')}</span>
          <Switch
            checked={d.scannable}
            onCheckedChange={(v) => setD((s) => ({ ...s, scannable: v }))}
          />
        </label>
      </div>
    </div>
  );
}
