import { zodResolver } from '@hookform/resolvers/zod';
import type { DocumentSigner, SignerRole } from '@org/api-client';
import { addSignerFormSchema, type AddSignerFormValues } from '@org/dto';
import { SCHEDULE_1_NOTE, isESignExcluded } from '@org/legal-reference';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import { useRef, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  useAddSigner,
  useRemoveSigner,
  useSigners,
  useSignSigner,
} from './queries';

const ROLE_LABELS: Record<SignerRole, string> = {
  party_a: 'Party A',
  party_b: 'Party B',
  witness: 'Witness',
  lawyer: 'Lawyer',
  custom: 'Other',
};

const STATUS_VARIANT: Record<
  string,
  'success' | 'secondary' | 'info' | 'error'
> = {
  signed: 'success',
  pending: 'secondary',
  invited: 'info',
  viewed: 'info',
  declined: 'error',
};

/**
 * Manage a document's signers and capture drawn/typed signatures (owner side).
 * Remote provider eSign (Aadhaar/DSC) is a separate flow.
 */
export function SignaturesDialog({
  documentId,
  open,
  onOpenChange,
  docTypeKey,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Doc-type / preset key — used to flag Schedule-1 eSign-excluded types. */
  docTypeKey?: string;
}) {
  const { t } = useTranslation();
  const excluded = isESignExcluded(docTypeKey);
  const signers = useSigners(documentId, open);
  const add = useAddSigner(documentId);
  const remove = useRemoveSigner(documentId);
  const sign = useSignSigner(documentId);

  const [signingId, setSigningId] = useState<string | null>(null);

  const items = signers.data ?? [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddSignerFormValues>({
    resolver: zodResolver(addSignerFormSchema) as Resolver<AddSignerFormValues>,
    defaultValues: { name: '', email: '', role: 'party_a' },
    mode: 'onBlur',
  });

  const addSigner = handleSubmit(async (v) => {
    await add.mutateAsync({
      name: v.name.trim(),
      email: v.email.trim() || undefined,
      role: v.role,
    });
    reset({ name: '', email: '', role: 'party_a' });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('signatures.title', 'Signatures')}</DialogTitle>
          <DialogDescription>
            {t(
              'signatures.description',
              'Add the people who need to sign, then capture each signature by drawing, uploading, or typing it. The document is marked signed once everyone has signed.',
            )}
          </DialogDescription>
        </DialogHeader>

        {excluded && (
          <div className="rounded-md border border-warning/40 bg-warning/50 p-2.5 text-xs text-foreground/80">
            {t('signatures.schedule1', SCHEDULE_1_NOTE)}
          </div>
        )}

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {signers.isLoading && (
            <p className="text-sm text-foreground/55">
              {t('common.loading', 'Loading…')}
            </p>
          )}
          {!signers.isLoading && items.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/55">
              {t('signatures.empty', 'No signers yet.')}
            </p>
          )}
          {items.map((s) => (
            <SignerRow
              key={s.id}
              signer={s}
              isSigning={signingId === s.id}
              onToggleSign={() =>
                setSigningId((cur) => (cur === s.id ? null : s.id))
              }
              onRemove={() => remove.mutate(s.id)}
              onSubmit={async (payload) => {
                await sign.mutateAsync({ signerId: s.id, payload });
                setSigningId(null);
              }}
              saving={sign.isPending}
            />
          ))}
        </div>

        <form
          onSubmit={addSigner}
          className="space-y-2 border-t border-border pt-3"
        >
          <Label className="text-xs text-foreground/60">
            {t('signatures.addSigner', 'Add a signer')}
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="sm:flex-1">
              <Input
                placeholder={t('signatures.fullName', 'Full name')}
                hasError={!!errors.name}
                {...register('name')}
              />
              {errors.name?.message && (
                <span className="text-xs text-error">
                  {errors.name.message}
                </span>
              )}
            </div>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as SignerRole[]).map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`signerRole.${r}`, ROLE_LABELS[r])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Input
              placeholder={t('signatures.emailOptional', 'Email (optional)')}
              type="email"
              hasError={!!errors.email}
              {...register('email')}
            />
            {errors.email?.message && (
              <span className="text-xs text-error">{errors.email.message}</span>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" isLoading={add.isPending}>
              {t('signatures.addSignerBtn', 'Add signer')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SignerRow({
  signer,
  isSigning,
  onToggleSign,
  onRemove,
  onSubmit,
  saving,
}: {
  signer: DocumentSigner;
  isSigning: boolean;
  onToggleSign: () => void;
  onRemove: () => void;
  onSubmit: (payload: {
    method: 'draw' | 'upload' | 'typed';
    image?: string;
    typedText?: string;
    font?: string;
  }) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const signed = signer.status === 'signed';
  const evidenceImage =
    typeof signer.evidence?.['image'] === 'string'
      ? (signer.evidence['image'] as string)
      : null;
  const evidenceTyped =
    typeof signer.evidence?.['typedText'] === 'string'
      ? (signer.evidence['typedText'] as string)
      : null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">
            {signer.name}
          </span>
          <span className="ml-2 text-[11px] text-foreground/45">
            {t(`signerRole.${signer.role}`, ROLE_LABELS[signer.role])}
            {signer.email ? ` · ${signer.email}` : ''}
          </span>
        </div>
        <Badge
          variant={STATUS_VARIANT[signer.status] ?? 'secondary'}
          outline={signer.status !== 'signed'}
        >
          {t(`signerStatus.${signer.status}`, signer.status)}
        </Badge>
      </div>

      {signed && (evidenceImage || evidenceTyped) && (
        <div className="mt-2">
          {evidenceImage ? (
            <img
              src={evidenceImage}
              alt={t('signatures.signatureAlt', '{{name}} signature', {
                name: signer.name,
              })}
              className="h-14 rounded border border-border bg-white object-contain"
            />
          ) : (
            <span
              className="text-2xl text-foreground"
              style={{ fontFamily: 'cursive' }}
            >
              {evidenceTyped}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSign}
          className="text-xs font-medium text-primary hover:underline"
        >
          {isSigning
            ? t('common.cancel', 'Cancel')
            : signed
              ? t('signatures.resign', 'Re-sign')
              : t('signatures.sign', 'Sign')}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-error hover:underline"
        >
          {t('signatures.remove', 'Remove')}
        </button>
      </div>

      {isSigning && (
        <SignatureCapture
          defaultName={signer.name}
          saving={saving}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function SignatureCapture({
  defaultName,
  saving,
  onSubmit,
}: {
  defaultName: string;
  saving: boolean;
  onSubmit: (payload: {
    method: 'draw' | 'upload' | 'typed';
    image?: string;
    typedText?: string;
    font?: string;
  }) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'draw' | 'upload' | 'typed'>('draw');
  const [typed, setTyped] = useState(defaultName);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Normalise an uploaded image: scale to a max width and re-encode PNG so it
  // stays well under the 2 MB cap and behaves like a drawn signature.
  function handleFile(file: File) {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError(
        t('signatures.errNotImage', 'Please choose an image file.'),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        if (!g) {
          setUploadError(
            t('signatures.errProcess', 'Could not process image.'),
          );
          return;
        }
        g.drawImage(img, 0, 0, w, h);
        setUploaded(c.toDataURL('image/png'));
      };
      img.onerror = () =>
        setUploadError(
          t('signatures.errReadImage', 'Could not read that image.'),
        );
      img.src = reader.result as string;
    };
    reader.onerror = () =>
      setUploadError(t('signatures.errReadFile', 'Could not read that file.'));
    reader.readAsDataURL(file);
  }

  function ctx() {
    const c = canvasRef.current;
    return c ? c.getContext('2d') : null;
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = ctx();
    if (!g) return;
    drawing.current = true;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.strokeStyle = '#111827';
    g.beginPath();
    g.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const g = ctx();
    if (!g) return;
    g.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    g.stroke();
    setHasInk(true);
  }
  function end() {
    drawing.current = false;
  }
  function clear() {
    const c = canvasRef.current;
    const g = ctx();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function submit() {
    if (mode === 'draw') {
      const c = canvasRef.current;
      if (!c || !hasInk) return;
      onSubmit({ method: 'draw', image: c.toDataURL('image/png') });
    } else if (mode === 'upload') {
      if (!uploaded) return;
      onSubmit({ method: 'upload', image: uploaded });
    } else {
      if (!typed.trim()) return;
      onSubmit({ method: 'typed', typedText: typed.trim(), font: 'cursive' });
    }
  }

  const canSave =
    mode === 'draw' ? hasInk : mode === 'upload' ? !!uploaded : !!typed.trim();

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/40 p-3">
      <div className="flex gap-2">
        {(['draw', 'upload', 'typed'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/60 hover:bg-secondary',
            )}
          >
            {m === 'draw'
              ? t('signatures.draw', 'Draw')
              : m === 'upload'
                ? t('signatures.upload', 'Upload')
                : t('signatures.type', 'Type')}
          </button>
        ))}
      </div>

      {mode === 'draw' ? (
        <div className="space-y-1.5">
          <canvas
            ref={canvasRef}
            width={440}
            height={150}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full touch-none rounded border border-border bg-white"
          />
          <button
            type="button"
            onClick={clear}
            className="text-xs text-foreground/55 hover:underline"
          >
            {t('signatures.clear', 'Clear')}
          </button>
        </div>
      ) : mode === 'upload' ? (
        <div className="space-y-1.5">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
          />
          {uploadError && <p className="text-xs text-error">{uploadError}</p>}
          {uploaded && (
            <img
              src={uploaded}
              alt={t('signatures.uploadedAlt', 'Uploaded signature')}
              className="h-16 rounded border border-border bg-white object-contain"
            />
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('signatures.typeNamePlaceholder', 'Type your name')}
          />
          <div className="flex h-14 items-center rounded border border-border bg-white px-3">
            <span
              className="text-2xl text-gray-900"
              style={{ fontFamily: 'cursive' }}
            >
              {typed || t('signatures.preview', 'Preview')}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          isLoading={saving}
          disabled={!canSave}
          onClick={submit}
        >
          {t('signatures.save', 'Save signature')}
        </Button>
      </div>
    </div>
  );
}
