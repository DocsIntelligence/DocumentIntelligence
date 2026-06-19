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
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { SignatureCapture } from './SignatureCapture';
import { useVaultService } from './services-context';
import { useAllVaultSignatures } from '../vault/queries';
import {
  useAddSigner,
  useRemoveSigner,
  useSigners,
  useSignSigner,
} from './queries';

type SignPayload = {
  method: 'draw' | 'upload' | 'typed';
  image?: string;
  typedText?: string;
  font?: string;
};

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
        <>
          <SavedSignaturePicker saving={saving} onPick={onSubmit} />
          <SignatureCapture
            defaultName={signer.name}
            saving={saving}
            onSubmit={onSubmit}
          />
        </>
      )}
    </div>
  );
}

/**
 * Lets the signer reuse a signature already saved in their Vault instead of
 * redrawing it. Reveals the chosen signature (audited server-side) and feeds
 * its payload into the same `onPick`/sign handler as a freshly-drawn one.
 */
function SavedSignaturePicker({
  saving,
  onPick,
}: {
  saving: boolean;
  onPick: (payload: SignPayload) => void;
}) {
  const { t } = useTranslation();
  const vault = useVaultService();
  const { data: saved } = useAllVaultSignatures(true);
  const [revealing, setRevealing] = useState(false);

  if (!saved || saved.length === 0) return null;

  const pick = async (value: string) => {
    const item = saved.find((s) => s.id === value);
    if (!item) return;
    setRevealing(true);
    try {
      const rev = await vault.revealSignature(item.entityId, item.id);
      onPick({
        method: rev.method,
        image: rev.image,
        typedText: rev.typedText,
        font: rev.font,
      });
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-secondary/30 p-2.5">
      <span className="text-xs font-medium text-foreground/70">
        {t('signatures.useSaved', 'Use a saved signature')}
      </span>
      <Select disabled={saving || revealing} onValueChange={pick}>
        <SelectTrigger className="h-8 w-auto min-w-48 text-xs">
          <SelectValue
            placeholder={t('signatures.pickSaved', 'Pick from Vault…')}
          />
        </SelectTrigger>
        <SelectContent>
          {saved.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label} · {s.entityLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {revealing && <Spinner className="h-4 w-4" />}
    </div>
  );
}
