import { zodResolver } from '@hookform/resolvers/zod';
import type { ShareMode } from '@org/api-client';
import { shareFormSchema, type ShareFormValues } from '@org/dto';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useCreateShare } from './queries';

const MODES: { value: ShareMode; label: string; hint: string }[] = [
  { value: 'view', label: 'View only', hint: 'Recipient can read the document.' },
  { value: 'comment', label: 'Comment', hint: 'Recipient can read and comment.' },
  { value: 'edit', label: 'Edit', hint: 'Recipient can edit the document.' },
];

const EXPIRY: { value: '0' | '7' | '30'; label: string }[] = [
  { value: '0', label: 'No expiry' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];

export function ShareDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const create = useCreateShare();
  const [url, setUrl] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ShareFormValues>({
    resolver: zodResolver(shareFormSchema) as Resolver<ShareFormValues>,
    defaultValues: { mode: 'view', password: '', expiryDays: '0' },
    mode: 'onBlur',
  });

  const mode = watch('mode');
  const password = watch('password');

  function resetAll() {
    reset({ mode: 'view', password: '', expiryDays: '0' });
    setUrl(null);
  }

  const createLink = handleSubmit(async (values) => {
    const days = Number(values.expiryDays);
    const expiresAt =
      days > 0
        ? new Date(Date.now() + days * 86_400_000).toISOString()
        : undefined;
    const share = await create.mutateAsync({
      documentId,
      mode: values.mode,
      password: values.password.trim() ? values.password.trim() : undefined,
      expiresAt,
    });
    setUrl(`${window.location.origin}/s/${share.token}`);
  });

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('share.copied', 'Link copied'));
    } catch {
      toast.error(t('share.copyError', 'Could not copy'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetAll();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('share.title', 'Share document')}</DialogTitle>
          <DialogDescription>
            {t(
              'share.description',
              'Create a link anyone can open. Optionally protect it with a password or an expiry.',
            )}
          </DialogDescription>
        </DialogHeader>

        {!url ? (
          <form onSubmit={createLink} className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="share-mode">{t('share.access', 'Access')}</Label>
              <Controller
                control={control}
                name="mode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="share-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {t(`share.mode.${m.value}`, m.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-foreground/50">
                {t(
                  `share.modeHint.${mode}`,
                  MODES.find((m) => m.value === mode)?.hint ?? '',
                )}
              </p>
            </div>

            <FormField
              label={t('share.password', 'Password (optional)')}
              error={errors.password?.message}
            >
              <Input
                id="share-password"
                type="password"
                placeholder={t(
                  'share.passwordPlaceholder',
                  'Leave blank for no password',
                )}
                hasError={!!errors.password}
                {...register('password')}
              />
            </FormField>

            <div className="grid gap-1.5">
              <Label htmlFor="share-expiry">
                {t('share.expires', 'Expires')}
              </Label>
              <Controller
                control={control}
                name="expiryDays"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="share-expiry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {t(`share.expiry.${e.value}`, e.label)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <DialogFooter className="mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" size="sm" isLoading={create.isPending}>
                {t('share.createLink', 'Create link')}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <div className="grid gap-2 py-2">
              <Label>{t('share.linkLabel', 'Shareable link')}</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={url} className="text-xs" />
                <Button size="sm" onClick={copy} className="flex-none">
                  {t('share.copy', 'Copy')}
                </Button>
              </div>
              {password.trim() && (
                <p className="text-xs text-foreground/50">
                  {t(
                    'share.passwordNote',
                    "Share the password separately — it isn't in the link.",
                  )}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                {t('common.done', 'Done')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
