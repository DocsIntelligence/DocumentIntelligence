import type { VaultFieldDef } from '@org/api-client';
import { VAULT_DOC_KINDS } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  DatePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from '@org/ui';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { useLookupOptions } from '../documents/queries';
import { useVaultService } from '../documents/services-context';
import {
  useAddVaultDocument,
  useDeleteVaultEntity,
  useDuplicateVaultEntity,
  useRemoveVaultDocument,
  useScanVaultDocument,
  useUpdateVaultEntity,
  useVaultEntity,
} from './queries';

const SCANNABLE = new Set(VAULT_DOC_KINDS.filter((k) => k.scannable).map((k) => k.kind));
const KIND_LABEL = new Map(VAULT_DOC_KINDS.map((k) => [k.kind, k.label]));

export function VaultEntityPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const svc = useVaultService();
  const { data, isLoading } = useVaultEntity(id);
  const update = useUpdateVaultEntity(id);
  const del = useDeleteVaultEntity();
  const duplicate = useDuplicateVaultEntity();
  const addDoc = useAddVaultDocument(id);
  const removeDoc = useRemoveVaultDocument(id);
  const scan = useScanVaultDocument(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [docKind, setDocKind] = useState('aadhaar');

  // Group fields by their `group` for a tidy layout.
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

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  const startEdit = async () => {
    setRevealing(true);
    try {
      const revealed = await svc.reveal(id);
      setForm({ ...revealed.fields });
      setEditing(true);
    } finally {
      setRevealing(false);
    }
  };

  const save = async () => {
    await update.mutateAsync({ fields: form });
    setEditing(false);
  };

  const onPickFile = async (file?: File) => {
    if (file) await addDoc.mutateAsync({ file, kind: docKind });
    if (fileRef.current) fileRef.current.value = '';
  };

  const openDoc = async (docId: string) => {
    const { url } = await svc.documentUrl(id, docId);
    window.open(url, '_blank', 'noopener');
  };

  const removeEntity = async () => {
    const ok = await confirm({
      title: t('vault.deleteTitle', 'Delete this entity?'),
      description: t('vault.deleteDesc', 'Its details and all attached documents are permanently removed.'),
      confirmLabel: t('common.delete', 'Delete'),
      variant: 'destructive',
    });
    if (ok) {
      await del.mutateAsync(id);
      navigate('/vault');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={data.kind === 'company' ? 'secondary' : 'primary'}>{data.kind}</Badge>
          <h1 className="text-xl font-semibold">{data.label}</h1>
          {!data.isActive && (
            <Badge variant="secondary" outline className="text-[10px]">
              {t('vault.disabled', 'Disabled')}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t('common.actions', 'Actions')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={async () => {
                  const copy = await duplicate.mutateAsync(id);
                  navigate(`/vault/${copy.id}`);
                }}
              >
                {t('vault.duplicate', 'Duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => update.mutate({ isActive: !data.isActive })}
              >
                {data.isActive ? t('vault.disable', 'Disable') : t('vault.enable', 'Enable')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="outline" size="sm">
            <Link to="/vault">{t('common.back', 'Back')}</Link>
          </Button>
        </div>
      </div>

      {/* Details (typed, grouped) */}
      <Card className="space-y-5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('vault.details', 'Details')}</h2>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={startEdit} disabled={revealing}>
              {revealing && <Spinner className="mr-2 h-4 w-4" />}
              {t('vault.revealEdit', 'Reveal & edit')}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button size="sm" onClick={save} disabled={update.isPending}>
                {update.isPending && <Spinner className="mr-2 h-4 w-4" />}
                {t('common.save', 'Save')}
              </Button>
            </div>
          )}
        </div>

        {groups.map(([group, fields]) => (
          <div key={group} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <FormField key={f.key} label={f.label + (f.sensitive ? ' 🔒' : '')}>
                  {editing ? (
                    <FieldInput
                      def={f}
                      value={form[f.key] ?? ''}
                      onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                    />
                  ) : (
                    <div className="rounded-md border bg-secondary/30 px-2.5 py-2 text-sm">
                      {data.fields[f.key] || <span className="text-muted-foreground">—</span>}
                    </div>
                  )}
                </FormField>
              ))}
            </div>
          </div>
        ))}
        {!editing && (
          <p className="text-xs text-muted-foreground">
            {t('vault.maskedNote', 'Sensitive values are masked. Reveal & edit to view or change them.')}
          </p>
        )}
      </Card>

      {/* Documents — upload by kind, scan to autofill */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('vault.documents', 'Documents')}</h2>
          <div className="flex items-center gap-2">
            <Select value={docKind} onValueChange={setDocKind}>
              <SelectTrigger className="h-8 w-auto min-w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VAULT_DOC_KINDS.map((k) => (
                  <SelectItem key={k.kind} value={k.kind}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={(e) => onPickFile(e.target.files?.[0])}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={addDoc.isPending}
            >
              {addDoc.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('vault.upload', 'Upload')}
            </Button>
          </div>
        </div>

        {data.documents.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t('vault.noDocs', 'No documents attached. Upload an Aadhaar/PAN and scan it to autofill.')}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{d.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {KIND_LABEL.get(d.kind) ?? d.kind}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {SCANNABLE.has(d.kind) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scan.mutate(d.id)}
                      disabled={scan.isPending}
                    >
                      {scan.isPending && scan.variables === d.id && (
                        <Spinner className="mr-2 h-4 w-4" />
                      )}
                      {t('vault.scan', 'Scan & autofill')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openDoc(d.id)}>
                    {t('vault.view', 'View')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error"
                    onClick={() => removeDoc.mutate(d.id)}
                  >
                    {t('common.remove', 'Remove')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" className="text-error" onClick={removeEntity}>
          {t('vault.deleteEntity', 'Delete entity')}
        </Button>
      </div>
    </div>
  );
}

/** Render the right input for a typed vault field. */
function FieldInput({
  def,
  value,
  onChange,
}: {
  def: VaultFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  // Lookup options (DB-driven, e.g. country/state) — cached query, shared.
  const { data: lookups } = useLookupOptions();

  if (def.type === 'select' || def.type === 'lookup') {
    const opts =
      def.type === 'lookup' && def.lookupKey
        ? (lookups?.[def.lookupKey] ?? []).map((o) => ({ value: o.value, label: o.label }))
        : (def.options ?? []).map((o) => ({ value: o, label: o }));
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {opts.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (def.type === 'textarea') {
    return (
      <Textarea
        value={value}
        placeholder={def.placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
      />
    );
  }
  if (def.type === 'date') {
    return <DatePicker value={value} onChange={onChange} placeholder={def.placeholder} />;
  }
  const type =
    def.type === 'number'
        ? 'number'
        : def.type === 'email'
          ? 'email'
          : def.type === 'tel'
            ? 'tel'
            : 'text';
  return (
    <Input
      type={type}
      value={value}
      placeholder={def.placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
