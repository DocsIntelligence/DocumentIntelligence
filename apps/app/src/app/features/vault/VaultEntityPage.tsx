import type { VaultFieldDef } from '@org/api-client';
import { VAULT_DOC_KINDS } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
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
import { KIND_BADGE, KIND_LABEL } from './kinds';

const SCANNABLE = new Set(
  VAULT_DOC_KINDS.filter((k) => k.scannable).map((k) => k.kind),
);
const DOC_KIND_LABEL = new Map(VAULT_DOC_KINDS.map((k) => [k.kind, k.label]));

/**
 * `/vault/:id` — read-only detail view of a vault entity. Mirrors the
 * detail-page pattern used by the admin managers (LookupGroupEditor,
 * CitationEditor, SchemaEditor): list → row → detail, with a separate
 * /edit route owning the form. Sensitive values stay masked here; the
 * Edit page reveals + lets the user change them.
 */
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
  const [docKind, setDocKind] = useState('aadhaar');

  // Group fields by their `group` for a tidy layout — same shape as the
  // edit page so users see the same arrangement before and after.
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
      description: t(
        'vault.deleteDesc',
        'Its details and all attached documents are permanently removed.',
      ),
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant={KIND_BADGE[data.kind] ?? 'secondary'}>
            {KIND_LABEL[data.kind] ?? data.kind}
          </Badge>
          <h1 className="truncate text-xl font-semibold">{data.label}</h1>
          {!data.isActive && (
            <Badge variant="secondary" outline className="text-[10px]">
              {t('vault.disabled', 'Disabled')}
            </Badge>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button asChild size="sm">
            <Link to={`/vault/${id}/edit`}>{t('common.edit', 'Edit')}</Link>
          </Button>
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
                {data.isActive
                  ? t('vault.disable', 'Disable')
                  : t('vault.enable', 'Enable')}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-error" onSelect={removeEntity}>
                {t('vault.deleteEntity', 'Delete entity')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="ghost" size="sm">
            <Link to="/vault">{t('common.back', 'Back')}</Link>
          </Button>
        </div>
      </div>

      {/* Details — read-only, grouped, sensitive values masked. */}
      <Card className="space-y-5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {t('vault.details', 'Details')}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {t(
              'vault.maskedNote',
              'Sensitive values are masked. Open Edit to reveal & change them.',
            )}
          </p>
        </div>

        {groups.map(([group, fields]) => (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <p className="text-xs text-foreground/60">
                    {f.label}
                    {f.sensitive && (
                      <span
                        role="img"
                        aria-label={t('vault.sensitive', 'Sensitive')}
                      >
                        {' 🔒'}
                      </span>
                    )}
                  </p>
                  <div className="rounded-md border bg-secondary/20 px-2.5 py-2 text-sm">
                    {data.fields[f.key] || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Documents — upload by kind, scan to autofill. Stays on the detail
          page because docs are an attachment, not a field — and scanning
          is an action on the detail object, not a form edit. */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {t('vault.documents', 'Documents')}
          </h2>
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
            {t(
              'vault.noDocs',
              'No documents attached. Upload an Aadhaar/PAN and scan it to autofill.',
            )}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.documents.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{d.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {DOC_KIND_LABEL.get(d.kind) ?? d.kind}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openDoc(d.id)}
                  >
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
    </div>
  );
}
