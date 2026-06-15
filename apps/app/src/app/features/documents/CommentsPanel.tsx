import { zodResolver } from '@hookform/resolvers/zod';
import { createCommentSchema } from '@org/dto';
import { Button, Textarea } from '@org/ui';
import { cn } from '@org/utils';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAddComment, useComments, useResolveComment } from './queries';

const commentBodySchema = createCommentSchema.pick({ body: true });

/**
 * Headerless comment thread for inline mounting in a side panel. The
 * dialog variant wraps this with a Dialog header. Logic is identical;
 * keep them in sync by editing this one and re-importing.
 */
export function CommentsPanel({
  documentId,
  enabled = true,
}: {
  documentId: string;
  /** When false, skips the list query (useful when mounted but hidden). */
  enabled?: boolean;
}) {
  const { t } = useTranslation();
  const comments = useComments(documentId, enabled);
  const add = useAddComment(documentId);
  const resolve = useResolveComment(documentId);
  const items = comments.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ body: string }>({
    resolver: zodResolver(commentBodySchema),
    defaultValues: { body: '' },
  });

  const submit = handleSubmit(async ({ body }) => {
    await add.mutateAsync(body.trim());
    reset({ body: '' });
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {comments.isLoading && (
          <p className="text-sm text-foreground/55">
            {t('common.loading', 'Loading…')}
          </p>
        )}
        {!comments.isLoading && items.length === 0 && (
          <p className="py-6 text-center text-sm text-foreground/55">
            {t('comments.empty', 'No comments yet.')}
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
              {c.resolved
                ? t('comments.reopen', 'Reopen')
                : t('comments.resolve', 'Resolve')}
            </button>
          </div>
        ))}
      </div>

      <form
        onSubmit={submit}
        className="flex-none space-y-2 border-t border-border px-3 py-3"
      >
        <Textarea
          placeholder={t('comments.placeholder', 'Write a comment…')}
          rows={3}
          aria-invalid={!!errors.body}
          {...register('body')}
        />
        {errors.body?.message && (
          <p role="alert" className="text-xs text-error">
            {errors.body.message}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" isLoading={add.isPending}>
            {t('comments.submit', 'Comment')}
          </Button>
        </div>
      </form>
    </div>
  );
}
