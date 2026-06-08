import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import { useState } from 'react';
import { useAddComment, useComments, useResolveComment } from './queries';

/**
 * Document-level comment thread (owner side). Guests comment via a
 * comment/edit share link — see SharedDocumentView.
 */
export function CommentsDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const comments = useComments(documentId, open);
  const add = useAddComment(documentId);
  const resolve = useResolveComment(documentId);
  const [body, setBody] = useState('');
  const items = comments.data ?? [];

  async function submit() {
    if (!body.trim()) return;
    await add.mutateAsync(body.trim());
    setBody('');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comments</DialogTitle>
          <DialogDescription>
            Discussion on this document. Comments from people you share a
            comment/edit link with appear here too.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {comments.isLoading && (
            <p className="text-sm text-foreground/55">Loading…</p>
          )}
          {!comments.isLoading && items.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/55">
              No comments yet.
            </p>
          )}
          {items.map((c) => (
            <div
              key={c.id}
              className={cn(
                'rounded-lg border border-border p-3',
                c.resolved && 'opacity-60',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">
                  {c.authorName}
                </span>
                <span className="text-[11px] text-foreground/45">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">
                {c.body}
              </p>
              <button
                type="button"
                onClick={() =>
                  resolve.mutate({ commentId: c.id, resolved: !c.resolved })
                }
                className="mt-1.5 text-xs font-medium text-primary hover:underline"
              >
                {c.resolved ? 'Reopen' : 'Resolve'}
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <Textarea
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              isLoading={add.isPending}
              disabled={!body.trim()}
              onClick={submit}
            >
              Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
