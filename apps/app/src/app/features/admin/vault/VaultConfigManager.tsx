import type {
  VaultBadgeVariant,
  VaultDocKindConfig,
  VaultEntityKindConfig,
  VaultEntityKindFieldLink,
  VaultFieldConfig,
} from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  Checkbox,
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
import { useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { useVaultAdminService } from '../../documents/services-context';
import { EditIcon, IconButton, TrashIcon } from '../intelligence/icons';
import {
  useDeleteVaultDocKind,
  useDeleteVaultEntityKind,
  useDeleteVaultField,
  useSetVaultEntityKindFields,
  useUpsertVaultDocKind,
  useUpsertVaultEntityKind,
  useUpsertVaultField,
  useVaultDocKinds,
  useVaultEntityKindFields,
  useVaultEntityKinds,
  useVaultFields,
} from './queries';

const TYPES = [
  'text',
  'textarea',
  'date',
  'number',
  'tel',
  'email',
  'select',
  'lookup',
] as const;

const BADGE_VARIANTS: VaultBadgeVariant[] = [
  'primary',
  'secondary',
  'info',
  'warning',
  'success',
];

/** Tabs shared across Entity kinds / Fields / Document kinds. */
function VaultConfigTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const tabs = [
    {
      to: '/config/vault',
      label: t('vaultAdmin.entityKinds', 'Entity kinds'),
    },
    {
      to: '/config/vault/fields',
      label: t('vaultAdmin.fields', 'Fields'),
    },
    {
      to: '/config/vault/doc-kinds',
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
    success: 'bg-success/50 text-success',
    muted: 'bg-secondary/40 text-foreground/55',
    info: 'bg-info/50 text-info',
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

// ────────────────────────────────────────────────────────────────────────
//  Entity kinds — primary tab
// ────────────────────────────────────────────────────────────────────────

export function EntityKindsManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const kinds = useVaultEntityKinds();
  const del = useDeleteVaultEntityKind();

  const openKind = (id: string) =>
    navigate(`/config/vault/entity-kinds/${encodeURIComponent(id)}/edit`);
  const newKind = () => navigate('/config/vault/entity-kinds/new');

  const onDelete = async (r: VaultEntityKindConfig) => {
    if (r.isSystem) {
      toast(
        t(
          'vaultAdmin.systemKindDelete',
          'System kinds cannot be deleted — disable them instead.',
        ),
      );
      return;
    }
    const ok = await confirm({
      title: t('vaultAdmin.deleteKindTitle', 'Delete this entity kind?'),
      description: t(
        'vaultAdmin.deleteKindDesc',
        'Existing entities of this kind are kept; the kind will no longer be selectable when creating new ones.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) del.mutate(r.id);
  };

  const rows = kinds.data ?? [];
  const activeCount = rows.filter((k) => k.isActive).length;
  const systemCount = rows.filter((k) => k.isSystem).length;

  const columns: DataTableColumn<VaultEntityKindConfig>[] = [
    {
      key: 'label',
      header: t('vaultAdmin.label', 'Label'),
      sortValue: (r) => r.label,
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant={r.badgeVariant}>{r.label}</Badge>
            {r.isSystem && (
              <Badge variant="secondary" outline className="text-[10px]">
                {t('vaultAdmin.system', 'System')}
              </Badge>
            )}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-foreground/45">
            {r.key}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status', 'Status'),
      width: 'w-28',
      sortValue: (r) => (r.isActive ? 1 : 0),
      cell: (r) =>
        r.isActive ? (
          <Badge variant="success" className="text-[10px]">
            {t('vaultAdmin.active', 'Active')}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            {t('vaultAdmin.disabled', 'Disabled')}
          </Badge>
        ),
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
            onClick={() => openKind(r.id)}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            danger
            title={
              r.isSystem
                ? t(
                    'vaultAdmin.systemKindLocked',
                    'System kind — cannot delete',
                  )
                : t('common.delete', 'Delete')
            }
            disabled={r.isSystem || del.isPending}
            onClick={() => onDelete(r)}
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
          label={t('vaultAdmin.totalKinds', 'Total kinds')}
          value={rows.length}
        />
        <StatTile
          label={t('vaultAdmin.activeKinds', 'Active')}
          value={activeCount}
          tone="success"
        />
        <StatTile
          label={t('vaultAdmin.disabledKinds', 'Disabled')}
          value={rows.length - activeCount}
          tone="muted"
        />
        <StatTile
          label={t('vaultAdmin.systemKinds', 'System')}
          value={systemCount}
          tone="info"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t('vaultAdmin.entityKindsHeading', 'Entity kinds')}
          </h3>
          <p className="mt-0.5 text-xs text-foreground/55">
            {t(
              'vaultAdmin.entityKindsHint',
              'What a Vault entity can be. Each kind picks which fields from the global pool it exposes — open one to manage its field map.',
            )}
          </p>
        </div>
        <Button onClick={newKind}>
          {t('vaultAdmin.addKind', '+ Add entity kind')}
        </Button>
      </div>

      {kinds.isLoading ? (
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
          tableId="admin.vault.entityKinds"
          data={rows}
          columns={columns}
          rowKey={(r) => r.id}
          search={(r) => `${r.label} ${r.key}`}
          searchPlaceholder={t(
            'vaultAdmin.searchKinds',
            'Search entity kinds…',
          )}
          initialSort={{ key: 'sortOrder', dir: 'asc' }}
          empty={t(
            'vaultAdmin.noKinds',
            'No entity kinds yet. Click "+ Add entity kind" to define one.',
          )}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Fields — global pool, kind-agnostic
// ────────────────────────────────────────────────────────────────────────

export function VaultFieldsManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const fields = useVaultFields();
  const kinds = useVaultEntityKinds();
  const delField = useDeleteVaultField();

  const openField = (id: string) =>
    navigate(`/config/vault/fields/${encodeURIComponent(id)}/edit`);
  const newField = () => navigate('/config/vault/fields/new');

  // Build a "used by" map: fieldId → kind labels/badges. Requires fetching
  // each kind's field-link list (kept off the hot path since the kind list
  // is small). Loaded once on mount via per-kind queries inside the table.
  const usedByMap = useUsedByMap(kinds.data ?? []);

  const onDeleteField = async (r: VaultFieldConfig) => {
    const ok = await confirm({
      title: t('vaultAdmin.deleteFieldTitle', 'Delete this field?'),
      description: t(
        'vaultAdmin.deleteFieldDesc',
        'The field is removed from every entity kind that links to it. Existing entity data is kept (keyed by the field key).',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) delField.mutate(r.id);
  };

  const rows = useMemo(() => fields.data ?? [], [fields.data]);
  const sensitiveCount = useMemo(
    () => rows.filter((f) => f.sensitive).length,
    [rows],
  );
  const lookupCount = useMemo(
    () => rows.filter((f) => f.type === 'lookup').length,
    [rows],
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
      width: 'w-32',
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
      width: 'w-36',
      sortValue: (r) => r.group ?? '',
      cell: (r) => r.group ?? <span className="text-foreground/45">—</span>,
    },
    {
      key: 'usedBy',
      header: t('vaultAdmin.usedBy', 'Used by'),
      sortValue: (r) => (usedByMap.get(r.id) ?? []).length,
      cell: (r) => {
        const linked = usedByMap.get(r.id) ?? [];
        if (linked.length === 0) {
          return <span className="text-xs text-foreground/45">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {linked.map((k) => (
              <Badge
                key={k.id}
                variant={k.badgeVariant}
                outline
                className="text-[10px]"
              >
                {k.label}
              </Badge>
            ))}
          </div>
        );
      },
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
          value={rows.length}
        />
        <StatTile
          label={t('vaultAdmin.sensitiveCount', 'Encrypted')}
          value={sensitiveCount}
          tone="success"
        />
        <StatTile
          label={t('vaultAdmin.lookupCount', 'Lookups')}
          value={lookupCount}
          tone="info"
        />
        <StatTile
          label={t('vaultAdmin.linkedKinds', 'Linked kinds')}
          value={kinds.data?.filter((k) => k.isActive).length ?? 0}
          tone="muted"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {t('vaultAdmin.fieldsHeading', 'Global field pool')}
          </h3>
          <p className="mt-0.5 text-xs text-foreground/55">
            {t(
              'vaultAdmin.fieldsHint',
              'Fields are shared. Aadhaar / PAN / address all live here once and are linked from one or more entity kinds.',
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
          initialSort={{ key: 'label', dir: 'asc' }}
          empty={t(
            'vaultAdmin.noFields',
            'No fields in the catalog yet. Click "+ Add field" to add one.',
          )}
        />
      )}
    </div>
  );
}

/**
 * Build a fieldId → linked-kinds map by querying each kind's field links
 * in parallel via useQueries (one stable hook call regardless of how many
 * kinds there are — Rules of Hooks safe). Cache keys match the per-kind
 * editor's query so opening a kind reuses the data.
 */
function useUsedByMap(kinds: VaultEntityKindConfig[]) {
  const svc = useVaultAdminService();
  const results = useQueries({
    queries: kinds.map((k) => ({
      queryKey: ['vault-admin', 'entity-kinds', k.id, 'fields'] as const,
      queryFn: () => svc.listEntityKindFields(k.id),
    })),
  });
  return useMemo(() => {
    const map = new Map<string, VaultEntityKindConfig[]>();
    results.forEach((r, i) => {
      const kind = kinds[i];
      const links = (r.data ?? []) as VaultEntityKindFieldLink[];
      for (const l of links) {
        const arr = map.get(l.fieldId) ?? [];
        if (!arr.find((k) => k.id === kind.id)) arr.push(kind);
        map.set(l.fieldId, arr);
      }
    });
    return map;
  }, [results, kinds]);
}

// ────────────────────────────────────────────────────────────────────────
//  Document kinds — secondary tab
// ────────────────────────────────────────────────────────────────────────

export function VaultDocKindsManager() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const docKinds = useVaultDocKinds();
  const delDocKind = useDeleteVaultDocKind();

  const openDocKind = (id: string) =>
    navigate(`/config/vault/doc-kinds/${encodeURIComponent(id)}/edit`);
  const newDocKind = () => navigate('/config/vault/doc-kinds/new');

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

// ────────────────────────────────────────────────────────────────────────
//  Field editor — used by both new/edit routed pages
// ────────────────────────────────────────────────────────────────────────

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
    key: initial.key ?? '',
    label: initial.label ?? '',
    type: initial.type ?? 'text',
    group: initial.group ?? '',
    options: (initial.options ?? []).join(', '),
    lookupKey: initial.lookupKey ?? '',
    sensitive: initial.sensitive ?? false,
    revealLast: initial.revealLast ?? 0,
    placeholder: initial.placeholder ?? '',
    isActive: initial.isActive ?? true,
  });

  const save = async () => {
    if (!f.key.trim() || !f.label.trim()) return;
    await upsert.mutateAsync({
      id: f.id,
      key: f.key.trim(),
      label: f.label.trim(),
      type: f.type as VaultFieldConfig['type'],
      group: f.group.trim() || null,
      options: f.options
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      lookupKey: f.lookupKey.trim() || null,
      sensitive: f.sensitive,
      revealLast: f.revealLast || null,
      placeholder: f.placeholder.trim() || null,
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
        <FormField label={t('vaultAdmin.group', 'Default group')}>
          <Input
            value={f.group}
            onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}
            placeholder="Identity / Address / …"
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
              onChange={(e) => setF((s) => ({ ...s, options: e.target.value }))}
            />
          </FormField>
        )}
        {f.type === 'lookup' && (
          <FormField
            label={t(
              'vaultAdmin.lookupKey',
              'Lookup key (e.g. in_states, country, gender, bar_council)',
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

// ────────────────────────────────────────────────────────────────────────
//  Entity-kind editor — basics + field-map editor
// ────────────────────────────────────────────────────────────────────────

export function VaultEntityKindForm({
  initial,
  onClose,
}: {
  initial: Partial<VaultEntityKindConfig>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const upsert = useUpsertVaultEntityKind();
  const [k, setK] = useState({
    id: initial.id,
    key: initial.key ?? '',
    label: initial.label ?? '',
    badgeVariant: (initial.badgeVariant ?? 'secondary') as VaultBadgeVariant,
    sortOrder: initial.sortOrder ?? 0,
    isActive: initial.isActive ?? true,
  });
  const isSystem = !!initial.isSystem;

  const save = async () => {
    if (!k.key.trim() || !k.label.trim()) return;
    const saved = await upsert.mutateAsync({
      id: k.id,
      key: k.key.trim(),
      label: k.label.trim(),
      badgeVariant: k.badgeVariant,
      sortOrder: Number(k.sortOrder) || 0,
      isActive: k.isActive,
    });
    // After create, land on the edit page so the user can immediately map
    // fields. After update, return to the list.
    if (!k.id) navigate(`/config/vault/entity-kinds/${saved.id}/edit`);
    else onClose();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border pb-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {t('common.back', 'Back')}
        </Button>
        <Button
          onClick={save}
          disabled={upsert.isPending || !k.key.trim() || !k.label.trim()}
        >
          {upsert.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('common.save', 'Save')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('vaultAdmin.key', 'Key (stable)')}>
          <Input
            value={k.key}
            disabled={isSystem || !!initial.id}
            onChange={(e) => setK((s) => ({ ...s, key: e.target.value }))}
            placeholder="lawyer"
          />
          {isSystem && (
            <p className="mt-1 text-[11px] text-foreground/55">
              {t(
                'vaultAdmin.systemKeyLocked',
                'System kinds cannot be renamed — their key is referenced by autofill and existing entities.',
              )}
            </p>
          )}
        </FormField>
        <FormField label={t('vaultAdmin.label', 'Label')}>
          <Input
            value={k.label}
            onChange={(e) => setK((s) => ({ ...s, label: e.target.value }))}
            placeholder="Lawyer"
          />
        </FormField>
        <FormField label={t('vaultAdmin.badgeVariant', 'Badge colour')}>
          <Select
            value={k.badgeVariant}
            onValueChange={(v) =>
              setK((s) => ({ ...s, badgeVariant: v as VaultBadgeVariant }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BADGE_VARIANTS.map((bv) => (
                <SelectItem key={bv} value={bv}>
                  <span className="inline-flex items-center gap-2">
                    <Badge variant={bv} className="text-[10px]">
                      {bv}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={t('vaultAdmin.sortOrder', 'Order')}>
          <Input
            type="number"
            value={k.sortOrder}
            onChange={(e) =>
              setK((s) => ({ ...s, sortOrder: Number(e.target.value) }))
            }
          />
        </FormField>
        <label className="flex items-center justify-between rounded-md border p-2 text-sm sm:col-span-2">
          <span>{t('vaultAdmin.active', 'Active')}</span>
          <Switch
            checked={k.isActive}
            onCheckedChange={(v) => setK((s) => ({ ...s, isActive: v }))}
          />
        </label>
      </div>

      {initial.id && (
        <KindFieldsEditor entityKindId={initial.id} kindLabel={k.label} />
      )}
      {!initial.id && (
        <Card className="rounded-lg border-dashed bg-secondary/40 p-4 text-xs text-foreground/55">
          {t(
            'vaultAdmin.saveFirstForFields',
            'Save the kind first, then map fields to it below.',
          )}
        </Card>
      )}
    </div>
  );
}

/**
 * Field-map editor: a checklist of all global fields with an order column
 * and an optional group override per kind. "+ Add new field" sends the
 * user to /config/vault/fields/new and they come back after
 * saving (the cache invalidation refreshes the list). Save batches the
 * desired set as a single PUT.
 */
function KindFieldsEditor({
  entityKindId,
  kindLabel,
}: {
  entityKindId: string;
  kindLabel: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fields = useVaultFields();
  const links = useVaultEntityKindFields(entityKindId);
  const setFields = useSetVaultEntityKindFields(entityKindId);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<string[]>([]);
  const [groupOverride, setGroupOverride] = useState<Record<string, string>>(
    {},
  );
  const [query, setQuery] = useState('');

  useEffect(() => {
    const list: VaultEntityKindFieldLink[] = links.data ?? [];
    setLinkedIds(new Set(list.map((l) => l.fieldId)));
    setOrder(list.map((l) => l.fieldId));
    const overrides: Record<string, string> = {};
    for (const l of list)
      if (l.groupOverride) overrides[l.fieldId] = l.groupOverride;
    setGroupOverride(overrides);
  }, [links.data]);

  const allFields = useMemo(() => fields.data ?? [], [fields.data]);
  const groupedFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allFields.filter(
      (f) =>
        !q ||
        f.key.toLowerCase().includes(q) ||
        f.label.toLowerCase().includes(q) ||
        (f.group ?? '').toLowerCase().includes(q),
    );
    const m = new Map<string, VaultFieldConfig[]>();
    for (const f of filtered) {
      const g = f.group ?? 'Other';
      const arr = m.get(g) ?? [];
      arr.push(f);
      m.set(g, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allFields, query]);

  const toggle = (fieldId: string) => {
    setLinkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
        setOrder((o) => o.filter((id) => id !== fieldId));
      } else {
        next.add(fieldId);
        setOrder((o) => [...o, fieldId]);
      }
      return next;
    });
  };

  const move = (fieldId: string, dir: -1 | 1) => {
    setOrder((o) => {
      const idx = o.indexOf(fieldId);
      if (idx < 0) return o;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= o.length) return o;
      const copy = [...o];
      const [removed] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, removed);
      return copy;
    });
  };

  const save = () => {
    setFields.mutate({
      links: order
        .filter((id) => linkedIds.has(id))
        .map((fieldId) => ({
          fieldId,
          groupOverride: groupOverride[fieldId] || null,
          isActive: true,
        })),
    });
  };

  const linkedCount = linkedIds.size;

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold">
            {t('vaultAdmin.fieldMapTitle', 'Fields on {{kind}}', {
              kind: kindLabel || t('vaultAdmin.thisKind', 'this kind'),
            })}
          </h4>
          <p className="mt-0.5 text-xs text-foreground/55">
            {t(
              'vaultAdmin.fieldMapHint',
              'Pick fields from the global pool. Order = display order in the entity editor. Group override only changes the section title; the field itself is unchanged.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/config/vault/fields/new')}
          >
            {t('vaultAdmin.newFieldLink', '+ Create new field')}
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={setFields.isPending || links.isLoading}
          >
            {setFields.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('vaultAdmin.saveMap', 'Save mapping')} ({linkedCount})
          </Button>
        </div>
      </div>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('vaultAdmin.searchFields', 'Search fields…')}
        className="max-w-sm"
      />

      {fields.isLoading || links.isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : groupedFields.length === 0 ? (
        <p className="py-4 text-center text-sm text-foreground/55">
          {t('vaultAdmin.noMatchingFields', 'No matching fields.')}
        </p>
      ) : (
        <div className="space-y-4">
          {groupedFields.map(([group, gFields]) => (
            <div key={group} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/45">
                {group}
              </p>
              <div className="divide-y divide-border/60 rounded-md border border-border">
                {gFields.map((f) => {
                  const isLinked = linkedIds.has(f.id);
                  const pos = order.indexOf(f.id);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        'flex flex-wrap items-center gap-2 px-3 py-2 text-sm',
                        !isLinked && 'opacity-60',
                      )}
                    >
                      <Checkbox
                        checked={isLinked}
                        onCheckedChange={() => toggle(f.id)}
                        aria-label={t(
                          'vaultAdmin.toggleField',
                          'Toggle {{field}}',
                          { field: f.label },
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">
                          {f.label}
                          {f.sensitive && (
                            <Badge
                              variant="warning"
                              outline
                              className="ml-1.5 text-[9px]"
                            >
                              encrypted
                            </Badge>
                          )}
                        </p>
                        <p className="truncate font-mono text-xs text-foreground/45">
                          {f.key} · {f.type}
                          {f.type === 'lookup' && f.lookupKey
                            ? `:${f.lookupKey}`
                            : ''}
                        </p>
                      </div>
                      {isLinked && (
                        <>
                          <Input
                            value={groupOverride[f.id] ?? ''}
                            onChange={(e) =>
                              setGroupOverride((s) => ({
                                ...s,
                                [f.id]: e.target.value,
                              }))
                            }
                            placeholder={t(
                              'vaultAdmin.groupOverride',
                              'Group override (optional)',
                            )}
                            className="h-8 max-w-[14rem] text-xs"
                          />
                          <div className="flex items-center gap-1">
                            <IconButton
                              title={t('vaultAdmin.moveUp', 'Move up')}
                              onClick={() => move(f.id, -1)}
                              disabled={pos <= 0}
                            >
                              <ArrowUp />
                            </IconButton>
                            <IconButton
                              title={t('vaultAdmin.moveDown', 'Move down')}
                              onClick={() => move(f.id, 1)}
                              disabled={pos === -1 || pos === order.length - 1}
                            >
                              <ArrowDown />
                            </IconButton>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ArrowUp() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg
      className="size-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="m5 12 7 7 7-7" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────
//  Doc-kind editor — unchanged shape, kept here for the IntelligenceConfigPage import
// ────────────────────────────────────────────────────────────────────────

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
          <span>
            {t('vaultAdmin.scannableLabel', 'Scannable (OCR autofill)')}
          </span>
          <Switch
            checked={d.scannable}
            onCheckedChange={(v) => setD((s) => ({ ...s, scannable: v }))}
          />
        </label>
      </div>
    </div>
  );
}

// Legacy alias used elsewhere — points at the Entity-kind manager now.
export const VaultConfigManager = EntityKindsManager;
