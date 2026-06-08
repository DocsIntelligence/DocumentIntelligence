import { Button, Card, Input, Label, PageLoader, Textarea } from '@org/ui';
import type { PageSizeKey } from '@org/document-templates';
import {
  isSharedDocument,
  type SharedComment,
  type SharedDocument,
} from '@org/api-client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PaginatedPreview } from '../editor/components/PaginatedPreview';
import { useSharesService } from './services-context';

/**
 * Public, no-auth view for a shared document (`/s/:token`). Renders freeform
 * documents read-only; on comment/edit links, shows a comment panel. Outside
 * ProtectedRoute in app.tsx.
 */
export function SharedDocumentView() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const shares = useSharesService();

  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [unlockPassword, setUnlockPassword] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState<SharedDocument | null>(null);
  const [comments, setComments] = useState<SharedComment[]>([]);
  const [guestName, setGuestName] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(
    async (pw?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await shares.resolve(token, pw);
        if (isSharedDocument(res)) {
          setShared(res);
          setComments(res.comments ?? []);
          setUnlockPassword(pw);
          setNeedsPassword(false);
        } else {
          setNeedsPassword(true);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : t('shared.linkInvalid', 'This link is invalid or expired.'),
        );
      } finally {
        setLoading(false);
      }
    },
    [shares, token, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function postComment() {
    if (!guestName.trim() || !commentBody.trim()) return;
    setPosting(true);
    try {
      const c = await shares.addComment(token, {
        authorName: guestName.trim(),
        body: commentBody.trim(),
        password: unlockPassword,
      });
      setComments((prev) => [...prev, c]);
      setCommentBody('');
      toast.success(t('shared.commentAdded', 'Comment added'));
    } catch {
      toast.error(t('shared.commentError', 'Could not post comment'));
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (error) {
    return (
      <Centered>
        <Card className="rounded-xl p-6 text-center">
          <p className="font-medium text-foreground">
            {t('shared.linkUnavailable', 'Link unavailable')}
          </p>
          <p className="mt-1 text-sm text-foreground/60">{error}</p>
        </Card>
      </Centered>
    );
  }

  if (needsPassword) {
    return (
      <Centered>
        <Card className="w-full max-w-sm rounded-xl p-6">
          <p className="font-medium text-foreground">
            {t('shared.passwordRequired', 'Password required')}
          </p>
          <p className="mt-1 text-sm text-foreground/60">
            {t(
              'shared.passwordHint',
              'This shared document is password-protected.',
            )}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void load(password);
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="share-pw">
                {t('shared.password', 'Password')}
              </Label>
              <Input
                id="share-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!password}>
              {t('shared.unlock', 'Unlock')}
            </Button>
          </form>
        </Card>
      </Centered>
    );
  }

  if (!shared) return null;

  const { document: doc } = shared;
  const isFreeform = doc.template.componentKey === 'freeform';
  const canComment = shared.mode === 'comment' || shared.mode === 'edit';
  const data = (doc.data ?? {}) as {
    html?: string;
    values?: Record<string, string>;
  };

  return (
    <div className="flex h-screen flex-col bg-secondary/10">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{doc.title}</div>
          <div className="truncate text-[11px] text-foreground/55">
            {t('shared.metaLine', '{{type}} · shared ({{mode}}) · read-only', {
              type: doc.documentType.name,
              mode: shared.mode,
            })}
          </div>
        </div>
        <span className="hidden flex-none text-[11px] text-foreground/45 sm:inline">
          {t(
            'shared.aiDisclaimer',
            'AI-assisted draft — verify with a qualified advocate',
          )}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1">
          {isFreeform ? (
            <PaginatedPreview
              html={data.html ?? ''}
              values={data.values ?? {}}
              pageSize={doc.pageSize as PageSizeKey}
            />
          ) : (
            <Centered>
              <Card className="rounded-xl p-6 text-center">
                <p className="font-medium text-foreground">
                  {t('shared.previewUnavailable', 'Preview not available here')}
                </p>
                <p className="mt-1 text-sm text-foreground/60">
                  {t(
                    'shared.previewUnavailableHint',
                    '“{{type}}” documents open in the app.',
                    { type: doc.documentType.name },
                  )}
                </p>
              </Card>
            </Centered>
          )}
        </div>

        {canComment && (
          <aside className="flex w-80 flex-none flex-col border-l border-border bg-background">
            <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
              {t('shared.comments', 'Comments')}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {comments.length === 0 && (
                <p className="py-6 text-center text-sm text-foreground/55">
                  {t('shared.noComments', 'No comments yet. Be the first.')}
                </p>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {c.authorName}
                    </span>
                    <span className="text-[11px] text-foreground/45">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-border p-3">
              <Input
                placeholder={t('shared.yourName', 'Your name')}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
              <Textarea
                placeholder={t('shared.addComment', 'Add a comment…')}
                rows={3}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                isLoading={posting}
                disabled={!guestName.trim() || !commentBody.trim()}
                onClick={postComment}
              >
                {t('shared.commentButton', 'Comment')}
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center p-6">
      {children}
    </div>
  );
}
