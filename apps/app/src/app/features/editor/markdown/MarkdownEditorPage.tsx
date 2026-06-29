import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageLoader } from '@org/ui';
import type { FreeformDocumentData } from '@org/dto';
import { useCreateDocument } from '../../documents/queries';

/**
 * `/editor/markdown` — entry point for a new Markdown document. Unlike the
 * freeform `/editor` localStorage scratchpad, a Markdown document is persisted
 * from the start: we create an empty backend `freeform` Document (with
 * `format: 'markdown'`) and redirect to the bound editor at
 * `/documents/:id/markdown`. That way the full editor shell is available
 * immediately — AI, export, signatures, comments, history, share — none of
 * which can work without a document id.
 */
export function MarkdownEditorPage() {
  const create = useCreateDocument();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // When launched from inside a group, file the new doc into it.
  const groupId = params.get('groupId') ?? undefined;
  // Create exactly once per mount (StrictMode double-invokes effects in dev).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const data = {
          format: 'markdown',
          markdown: '',
          html: '',
        } satisfies FreeformDocumentData;
        const doc = await create.mutateAsync({
          title: 'Untitled document',
          documentTypeKey: 'freeform',
          templateKey: 'freeform',
          data,
          groupId,
        });
        navigate(`/documents/${doc.id}/markdown`, { replace: true });
      } catch {
        // useCreateDocument surfaces the error toast; bail back to documents.
        navigate('/documents', { replace: true });
      }
    })();
  }, [create, navigate, groupId]);

  return (
    <div className="flex h-screen items-center justify-center">
      <PageLoader />
    </div>
  );
}
