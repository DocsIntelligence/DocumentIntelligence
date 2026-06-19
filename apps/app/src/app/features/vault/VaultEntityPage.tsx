import type { VaultFieldDef, VaultSignatureReveal } from '@org/api-client';
import { VAULT_DOC_KINDS } from '@org/api-client';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
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
import { toast } from 'sonner';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../components/page-header';
import { useVaultService } from '../documents/services-context';
import {
  useAddVaultDocument,
  useAddVaultSignature,
  useBulkScanVaultDocuments,
  useDeleteVaultEntity,
  useDuplicateVaultEntity,
  useRemoveVaultDocument,
  useRemoveVaultSignature,
  useScanVaultDocument,
  useSetDefaultVaultSignature,
  useUpdateVaultEntity,
  useVaultEntity,
} from './queries';
import { SignatureCapture } from '../documents/SignatureCapture';
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
  const bulkScan = useBulkScanVaultDocuments(id);
  const addSig = useAddVaultSignature(id);
  const setDefaultSig = useSetDefaultVaultSignature(id);
  const removeSig = useRemoveVaultSignature(id);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const [docKind, setDocKind] = useState('aadhaar');
  const [addingSig, setAddingSig] = useState(false);
  const [sigLabel, setSigLabel] = useState('Signature');
  const [sigPreview, setSigPreview] = useState<VaultSignatureReveal | null>(null);

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

  const onPickBulk = async (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length) await bulkScan.mutateAsync(list);
    if (bulkRef.current) bulkRef.current.value = '';
  };

  const openDoc = async (docId: string) => {
    const { url } = await svc.documentUrl(id, docId);
    window.open(url, '_blank', 'noopener');
  };

  const saveSignature = async (payload: {
    method: 'draw' | 'upload' | 'typed';
    image?: string;
    typedText?: string;
    font?: string;
  }) => {
    await addSig.mutateAsync({
      ...payload,
      label: sigLabel.trim() || 'Signature',
    });
    setAddingSig(false);
    setSigLabel('Signature');
  };

  const previewSignature = async (sigId: string) => {
    setSigPreview(await svc.revealSignature(id, sigId));
  };

  const estateLink = data.estateLink;
  const removeEntity = async () => {
    if (estateLink) {
      toast.error(
        estateLink.kind === 'profile'
          ? t(
              'vault.deleteBlockedProfile',
              'This person backs a Wealth Vault profile. Remove it from the Wealth Vault first.',
            )
          : t(
              'vault.deleteBlockedNominee',
              'This person is a Wealth Vault nominee. Remove the nominee from the Wealth Vault first.',
            ),
      );
      return;
    }
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
    <div className="space-y-6">
      <PageHeader
        backTo="/vault"
        title={
          <span className="flex items-center gap-2">
            <Badge variant={KIND_BADGE[data.kind] ?? 'secondary'}>
              {KIND_LABEL[data.kind] ?? data.kind}
            </Badge>
            <span className="truncate">{data.label}</span>
            {!data.isActive && (
              <Badge variant="secondary" outline className="text-[10px]">
                {t('vault.disabled', 'Disabled')}
              </Badge>
            )}
          </span>
        }
        actions={
          <>
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
                <DropdownMenuItem
                  className="text-error"
                  disabled={!!estateLink}
                  onSelect={removeEntity}
                >
                  {t('vault.deleteEntity', 'Delete entity')}
                  {estateLink
                    ? ` — ${t('vault.inWealthVault', 'in Wealth Vault')}`
                    : ''}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

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
                  <div className="rounded-md border bg-secondary/40 px-2.5 py-2 text-sm">
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
            <input
              ref={bulkRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf"
              onChange={(e) => onPickBulk(e.target.files)}
            />
            <Button
              size="sm"
              onClick={() => bulkRef.current?.click()}
              disabled={bulkScan.isPending}
              title={t(
                'vault.bulkScanHint',
                'Upload Aadhaar, PAN, etc. together — we detect each, attach it, and autofill the profile',
              )}
            >
              {bulkScan.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('vault.bulkScan', 'Upload & autofill')}
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

      {/* Signatures — reusable, encrypted. Capture once here, then pick one when
          signing a document instead of redrawing. Images are masked (shown only
          on an audited reveal). */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">
              {t('vault.signatures', 'Signatures')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t(
                'vault.signaturesHint',
                'Saved signatures can be reused when signing documents.',
              )}
            </p>
          </div>
          <Button
            size="sm"
            variant={addingSig ? 'ghost' : 'outline'}
            onClick={() => setAddingSig((v) => !v)}
          >
            {addingSig
              ? t('common.cancel', 'Cancel')
              : t('vault.addSignature', 'Add signature')}
          </Button>
        </div>

        {addingSig && (
          <div className="space-y-2">
            <Input
              value={sigLabel}
              onChange={(e) => setSigLabel(e.target.value)}
              placeholder={t('vault.signatureLabel', 'Label (e.g. Full signature)')}
              maxLength={80}
            />
            <SignatureCapture
              defaultName={data.label}
              saving={addSig.isPending}
              onSubmit={saveSignature}
              submitLabel={t('vault.saveSignature', 'Save to vault')}
            />
          </div>
        )}

        {data.signatures.length === 0 ? (
          !addingSig && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('vault.noSignatures', 'No signatures saved yet.')}
            </p>
          )
        ) : (
          <div className="divide-y divide-border/60">
            {data.signatures.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm">{s.label}</p>
                  <Badge variant="secondary">{s.method}</Badge>
                  {s.isDefault && (
                    <Badge variant="success">
                      {t('vault.default', 'Default')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => previewSignature(s.id)}
                  >
                    {t('vault.reveal', 'Reveal')}
                  </Button>
                  {!s.isDefault && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDefaultSig.mutate(s.id)}
                      disabled={setDefaultSig.isPending}
                    >
                      {t('vault.makeDefault', 'Make default')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-error"
                    onClick={() => removeSig.mutate(s.id)}
                  >
                    {t('common.remove', 'Remove')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        open={!!sigPreview}
        onOpenChange={(open) => !open && setSigPreview(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sigPreview?.label}</DialogTitle>
          </DialogHeader>
          {sigPreview &&
            (sigPreview.method === 'typed' ? (
              <div className="flex h-24 items-center justify-center rounded border border-border bg-white px-4">
                <span
                  className="text-3xl text-gray-900"
                  style={{ fontFamily: sigPreview.font || 'cursive' }}
                >
                  {sigPreview.typedText}
                </span>
              </div>
            ) : (
              sigPreview.image && (
                <img
                  src={sigPreview.image}
                  alt={sigPreview.label}
                  className="max-h-48 w-full rounded border border-border bg-white object-contain p-2"
                />
              )
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
