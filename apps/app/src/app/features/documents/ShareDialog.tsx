import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ShareMode } from '@org/api-client';
import { useCreateShare } from './queries';

const MODES: { value: ShareMode; label: string; hint: string }[] = [
  { value: 'view', label: 'View only', hint: 'Recipient can read the document.' },
  { value: 'comment', label: 'Comment', hint: 'Recipient can read and comment.' },
  { value: 'edit', label: 'Edit', hint: 'Recipient can edit the document.' },
];

const EXPIRY: { value: string; label: string }[] = [
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
  const [mode, setMode] = useState<ShareMode>('view');
  const [password, setPassword] = useState('');
  const [expiryDays, setExpiryDays] = useState('0');
  const [url, setUrl] = useState<string | null>(null);

  function reset() {
    setMode('view');
    setPassword('');
    setExpiryDays('0');
    setUrl(null);
  }

  async function createLink() {
    const days = Number(expiryDays);
    const expiresAt =
      days > 0
        ? new Date(Date.now() + days * 86_400_000).toISOString()
        : undefined;
    const share = await create.mutateAsync({
      documentId,
      mode,
      password: password.trim() ? password.trim() : undefined,
      expiresAt,
    });
    setUrl(`${window.location.origin}/s/${share.token}`);
  }

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
        if (!v) reset();
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
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="share-mode">{t('share.access', 'Access')}</Label>
              <select
                id="share-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as ShareMode)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {t(`share.mode.${m.value}`, m.label)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-foreground/50">
                {t(
                  `share.modeHint.${mode}`,
                  MODES.find((m) => m.value === mode)?.hint ?? '',
                )}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="share-password">
                {t('share.password', 'Password (optional)')}
              </Label>
              <Input
                id="share-password"
                type="password"
                placeholder={t(
                  'share.passwordPlaceholder',
                  'Leave blank for no password',
                )}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="share-expiry">{t('share.expires', 'Expires')}</Label>
              <select
                id="share-expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {EXPIRY.map((e) => (
                  <option key={e.value} value={e.value}>
                    {t(`share.expiry.${e.value}`, e.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
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
        )}

        <DialogFooter>
          {!url ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                size="sm"
                isLoading={create.isPending}
                onClick={createLink}
              >
                {t('share.createLink', 'Create link')}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => onOpenChange(false)}>
              {t('common.done', 'Done')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
