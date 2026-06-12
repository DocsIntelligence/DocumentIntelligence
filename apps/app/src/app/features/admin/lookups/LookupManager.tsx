import { zodResolver } from '@hookform/resolvers/zod';
import type { LookupGroup, LookupValue } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  FormField,
  Input,
  type DataTableColumn,
} from '@org/ui';
import { useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { applyServerFieldErrors } from '../../../lib/server-errors';
import {
  CopyIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  IconButton,
  TrashIcon,
} from '../intelligence/icons';
import {
  useAddValue,
  useAdminLookups,
  useCreateGroup,
  useDeleteGroup,
  useDeleteValue,
  useDuplicateGroup,
  useUpdateGroup,
  useUpdateValue,
} from './queries';

const groupSchema = z.object({
  key: z
    .string()
    .min(1, 'Required')
    .regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers and underscores only'),
  name: z.string().min(1, 'Required'),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
});
type GroupForm = z.infer<typeof groupSchema>;

/**
 * Admin manager for LookupGroups/LookupValues — the option-sets that drive the
 * builder's `lookup` form fields (currency, party relations, tax modes, …).
 * List + create groups, then manage each group's values (label/value/order,
 * enable/disable, delete).
 */
export function LookupManager() {
  const { t } = useTranslation();
  const { data: groups, isLoading } = useAdminLookups();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const confirm = useConfirm();
  const deleteGroup = useDeleteGroup();
  const duplicateGroup = useDuplicateGroup();

  const selected = useMemo(
    () => groups?.find((g) => g.id === selectedId) ?? null,
    [groups, selectedId],
  );

  // Pick a key not already taken (key, key_copy, key_copy_2, …).
  const uniqueKey = (base: string) => {
    const existing = new Set((groups ?? []).map((g) => g.key));
    let candidate = `${base}_copy`;
    let i = 2;
    while (existing.has(candidate)) candidate = `${base}_copy_${i++}`;
    return candidate;
  };

  const onDuplicate = (g: LookupGroup) =>
    duplicateGroup.mutate({
      key: uniqueKey(g.key),
      name: `${g.name} (copy)`,
      description: g.description,
      isPublic: g.isPublic,
      values: g.values.map((v) => ({
        label: v.label,
        value: v.value,
        order: v.order,
      })),
    });

  if (creating) {
    return <CreateGroup onClose={() => setCreating(false)} />;
  }
  if (selectedId) {
    if (!selected) {
      return (
        <p className="text-sm text-foreground/60">
          {t('common.loading', 'Loading…')}
        </p>
      );
    }
    return <GroupEditor group={selected} onClose={() => setSelectedId(null)} />;
  }

  const onDelete = async (g: LookupGroup) => {
    const ok = await confirm({
      title: t('adminLookups.deleteTitle', 'Delete lookup group?'),
      description: t(
        'adminLookups.deleteDesc',
        'This deletes the group and all its values. Any form field using it will fall back to free text.',
      ),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) deleteGroup.mutate(g.id);
  };

  const columns: DataTableColumn<LookupGroup>[] = [
    {
      key: 'name',
      header: t('adminLookups.name', 'Name'),
      sortValue: (g) => g.name.toLowerCase(),
      cell: (g) => <span className="font-medium text-foreground">{g.name}</span>,
    },
    {
      key: 'key',
      header: t('adminLookups.key', 'Key'),
      sortValue: (g) => g.key,
      cell: (g) => (
        <code className="text-foreground/55 text-xs">{g.key}</code>
      ),
    },
    {
      key: 'count',
      header: t('adminLookups.values', 'Values'),
      align: 'right',
      sortValue: (g) => g.values.length,
      cell: (g) => <span className="tabular-nums">{g.values.length}</span>,
    },
    {
      key: 'public',
      header: t('adminLookups.visibility', 'Visibility'),
      cell: (g) =>
        g.isPublic === false ? (
          <Badge variant="secondary">{t('adminLookups.private', 'private')}</Badge>
        ) : (
          <Badge variant="info">{t('adminLookups.public', 'public')}</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (g) => (
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={t('adminLookups.manage', 'Manage values')}
            onClick={() => setSelectedId(g.id)}
          >
            <EditIcon />
          </IconButton>
          <IconButton
            title={t('adminLookups.duplicate', 'Duplicate (with values)')}
            disabled={duplicateGroup.isPending}
            onClick={() => onDuplicate(g)}
          >
            <CopyIcon />
          </IconButton>
          <IconButton
            danger
            title={t('common.delete', 'Delete')}
            disabled={deleteGroup.isPending}
            onClick={() => onDelete(g)}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {t('adminLookups.title', 'Lookups')}
          </h3>
          <p className="text-sm text-foreground/55">
            {t(
              'adminLookups.subtitle',
              'Reusable option-sets for form dropdowns (currency, relations, tax modes…).',
            )}
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          {t('adminLookups.new', 'New group')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-foreground/60">
          {t('common.loading', 'Loading…')}
        </p>
      ) : (
        <DataTable
          data={groups ?? []}
          columns={columns}
          rowKey={(g) => g.id}
          search={(g) => `${g.name} ${g.key}`}
          searchPlaceholder={t('adminLookups.search', 'Search lookups…')}
          initialSort={{ key: 'name', dir: 'asc' }}
          empty={t('adminLookups.empty', 'No lookup groups yet.')}
        />
      )}
    </div>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateGroup();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema) as Resolver<GroupForm>,
    defaultValues: { key: '', name: '', description: '', isPublic: true },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        key: values.key,
        name: values.name,
        description: values.description || undefined,
        isPublic: values.isPublic,
      });
      onClose();
    } catch (err) {
      applyServerFieldErrors(err, setError);
    }
  });

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {t('adminLookups.newTitle', 'New lookup group')}
        </h3>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </div>
      <FormField
        label={t('adminLookups.key', 'Key (stable id)')}
        error={errors.key?.message}
      >
        <Input placeholder="e.g. currency" {...register('key')} />
      </FormField>
      <FormField
        label={t('adminLookups.name', 'Display name')}
        error={errors.name?.message}
      >
        <Input placeholder="Currency" {...register('name')} />
      </FormField>
      <FormField
        label={t('adminLookups.description', 'Description (optional)')}
        error={errors.description?.message}
      >
        <Input {...register('description')} />
      </FormField>
      <label className="flex items-center gap-2 text-sm text-foreground/70">
        <Checkbox
          checked={watch('isPublic')}
          onCheckedChange={(v) => setValue('isPublic', Boolean(v))}
        />
        {t('adminLookups.publicLabel', 'Public (readable without admin)')}
      </label>
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending
            ? t('common.saving', 'Saving…')
            : t('adminLookups.create', 'Create group')}
        </Button>
      </div>
    </form>
  );
}

function GroupEditor({
  group,
  onClose,
}: {
  group: LookupGroup;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const updateGroup = useUpdateGroup();
  const addValue = useAddValue();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? '');
  const [isPublic, setIsPublic] = useState(group.isPublic !== false);
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const saveMeta = () =>
    updateGroup.mutate({
      id: group.id,
      payload: { name, description: description || undefined, isPublic },
    });

  const onAdd = () => {
    if (!newLabel.trim()) return;
    addValue.mutate(
      {
        groupId: group.id,
        payload: {
          label: newLabel.trim(),
          value: (newValue.trim() || newLabel.trim()),
          order: group.values.length,
        },
      },
      {
        onSuccess: () => {
          setNewLabel('');
          setNewValue('');
        },
      },
    );
  };

  const sorted = [...group.values].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">
            {group.name}{' '}
            <code className="text-xs text-foreground/50">({group.key})</code>
          </h3>
        </div>
        <Button variant="ghost" onClick={onClose}>
          {t('common.back', 'Back')}
        </Button>
      </div>

      {/* Group meta */}
      <Card className="space-y-3 rounded-xl p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t('adminLookups.name', 'Display name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label={t('adminLookups.description', 'Description')}>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <Checkbox
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(Boolean(v))}
            />
            {t('adminLookups.publicLabel', 'Public (readable without admin)')}
          </label>
          <Button
            variant="secondary"
            disabled={updateGroup.isPending}
            onClick={saveMeta}
          >
            {t('adminLookups.saveGroup', 'Save group')}
          </Button>
        </div>
      </Card>

      {/* Values */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground/70">
          {t('adminLookups.values', 'Values')}
        </h4>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-foreground/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {t('adminLookups.label', 'Label')}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t('adminLookups.value', 'Value')}
                </th>
                <th className="w-20 px-3 py-2 text-right font-medium">
                  {t('adminLookups.order', 'Order')}
                </th>
                <th className="w-24 px-3 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((v) => (
                <ValueRow key={v.id} value={v} />
              ))}
              <tr className="border-t border-border bg-background">
                <td className="px-3 py-2">
                  <Input
                    value={newLabel}
                    placeholder={t('adminLookups.label', 'Label')}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={newValue}
                    placeholder={t(
                      'adminLookups.valuePlaceholder',
                      'value (defaults to label)',
                    )}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </td>
                <td />
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    disabled={addValue.isPending || !newLabel.trim()}
                    onClick={onAdd}
                  >
                    {t('adminLookups.add', 'Add')}
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ValueRow({ value }: { value: LookupValue }) {
  const { t } = useTranslation();
  const updateValue = useUpdateValue();
  const deleteValue = useDeleteValue();
  const confirm = useConfirm();
  const [label, setLabel] = useState(value.label);
  const [val, setVal] = useState(value.value ?? '');
  const [order, setOrder] = useState(String(value.order));

  const saveIfChanged = () => {
    const payload: {
      label?: string;
      value?: string;
      order?: number;
    } = {};
    if (label !== value.label) payload.label = label;
    if (val !== (value.value ?? '')) payload.value = val;
    const o = Number(order);
    if (!Number.isNaN(o) && o !== value.order) payload.order = o;
    if (Object.keys(payload).length) {
      updateValue.mutate({ id: value.id, payload });
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: t('adminLookups.deleteValueTitle', 'Delete this value?'),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) deleteValue.mutate(value.id);
  };

  const active = value.isActive !== false;

  return (
    <tr className={`border-t border-border ${active ? '' : 'opacity-50'}`}>
      <td className="px-3 py-1.5">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveIfChanged}
        />
      </td>
      <td className="px-3 py-1.5">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={saveIfChanged}
        />
      </td>
      <td className="px-3 py-1.5">
        <Input
          value={order}
          inputMode="numeric"
          className="text-right"
          onChange={(e) => setOrder(e.target.value)}
          onBlur={saveIfChanged}
        />
      </td>
      <td className="px-3 py-1.5 text-right">
        <div className="flex items-center justify-end gap-0.5">
          <IconButton
            title={
              active
                ? t('adminLookups.disable', 'Disable')
                : t('adminLookups.enable', 'Enable')
            }
            onClick={() =>
              updateValue.mutate({
                id: value.id,
                payload: { isActive: !active },
              })
            }
          >
            {active ? <EyeIcon /> : <EyeOffIcon />}
          </IconButton>
          <IconButton danger title={t('common.delete', 'Delete')} onClick={onDelete}>
            <TrashIcon />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}
