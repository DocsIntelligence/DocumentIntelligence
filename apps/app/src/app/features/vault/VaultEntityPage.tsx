import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { useVaultService } from '../documents/services-context';
import {
  useAddVaultDocument,
  useDeleteVaultEntity,
  useRemoveVaultDocument,
  useUpdateVaultEntity,
  useVaultEntity,
} from './queries';

const DOC_KINDS = ['aadhaar', 'pan', 'passport', 'incorporation', 'gst', 'other'];

export function VaultEntityPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const svc = useVaultService();
  const { data, isLoading } = useVaultEntity(id);
  const update = useUpdateVaultEntity(id);
  const del = useDeleteVaultEntity();
  const addDoc = useAddVaultDocument(id);
  const removeDoc = useRemoveVaultDocument(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [docKind, setDocKind] = useState('aadhaar');

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // Enter edit mode: fetch the UNMASKED fields (audited) so the user edits real values.
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
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={data.kind === 'company' ? 'secondary' : 'primary'}>{data.kind}</Badge>
          <h1 className="text-xl font-semibold">{data.label}</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/vault">{t('common.back', 'Back')}</Link>
        </Button>
      </div>

      {/* Details */}
      <Card className="space-y-4 p-4">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.schema.map((f) => (
            <FormField key={f.key} label={f.label + (f.sensitive ? ' 🔒' : '')}>
              {editing ? (
                <Input
                  value={form[f.key] ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              ) : (
                <div className="rounded-md border bg-secondary/30 px-2.5 py-2 text-sm">
                  {data.fields[f.key] || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              )}
            </FormField>
          ))}
        </div>
        {!editing && (
          <p className="text-xs text-muted-foreground">
            {t('vault.maskedNote', 'Sensitive values are masked. Reveal & edit to view or change them.')}
          </p>
        )}
      </Card>

      {/* Documents */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t('vault.documents', 'Documents')}</h2>
          <div className="flex items-center gap-2">
            <Select value={docKind} onValueChange={setDocKind}>
              <SelectTrigger className="h-8 w-auto min-w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
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
            {t('vault.noDocs', 'No documents attached.')}
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{d.filename}</p>
                  <p className="text-xs text-muted-foreground">{d.kind}</p>
                </div>
                <div className="flex items-center gap-1">
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
