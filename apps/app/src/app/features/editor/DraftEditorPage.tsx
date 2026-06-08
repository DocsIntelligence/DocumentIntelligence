import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageLoader } from '@org/ui';
import { TemplateEditor, type EditorDraftState } from './TemplateEditor';
import { useDocument, usePatchDocument } from '../documents/queries';
import { useLegalAiService } from '../documents/services-context';
import { useExportPdf } from '../documents/builder/useExportPdf';
import { ShareDialog } from '../documents/ShareDialog';
import { VersionHistoryDialog } from '../documents/VersionHistoryDialog';
import { CommentsDialog } from '../documents/CommentsDialog';
import { SignaturesDialog } from '../documents/SignaturesDialog';

/**
 * `/documents/:id/draft` — the freeform editor bound to a backend Document.
 * Loads `data.{html,values,templateId}`, autosaves edits via PATCH (debounced
 * inside the editor), and reports the persisted save time back to the editor.
 */
export function DraftEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading, isError } = useDocument(id);
  const patch = usePatchDocument(id ?? '');
  const legalAi = useLegalAiService();
  const { state: exportState, start: startExport } = useExportPdf(id ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [signaturesOpen, setSignaturesOpen] = useState(false);

  // Reliable PDF via the backend Puppeteer service — open it when ready.
  useEffect(() => {
    if (exportState.phase === 'ready') {
      window.open(exportState.url, '_blank', 'noopener,noreferrer');
      toast.success('PDF ready — opened in a new tab');
    } else if (exportState.phase === 'failed') {
      toast.error(`Export failed: ${exportState.error}`);
    }
  }, [exportState]);

  const docTypeKey = doc?.documentType?.key;
  const handleAiGenerate = useCallback(
    async (brief: string, language: string) => {
      const r = await legalAi.generate({
        brief,
        language,
        documentTypeKey: docTypeKey,
      });
      return { html: r.html, disclaimer: r.disclaimer };
    },
    [legalAi, docTypeKey],
  );
  const handleAiRevise = useCallback(
    async (instruction: string, html: string, language?: string) => {
      const r = await legalAi.revise({
        instruction,
        html,
        language,
        documentTypeKey: docTypeKey,
      });
      return { html: r.html };
    },
    [legalAi, docTypeKey],
  );

  const handleSave = useCallback(
    (s: EditorDraftState) => {
      patch.mutate(
        {
          title: s.title,
          data: { html: s.html, values: s.values, templateId: s.templateId },
        },
        { onSuccess: () => setSavedAt(Date.now()) },
      );
    },
    [patch],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="p-8 text-sm text-foreground/60">
        Document not found, or you don't have access to it.
      </div>
    );
  }

  const data = (doc.data ?? {}) as {
    html?: string;
    values?: Record<string, string>;
    templateId?: string;
  };

  return (
    <>
      {id && (
        <>
          <ShareDialog
            documentId={id}
            open={shareOpen}
            onOpenChange={setShareOpen}
          />
          <VersionHistoryDialog
            documentId={id}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
          />
          <CommentsDialog
            documentId={id}
            open={commentsOpen}
            onOpenChange={setCommentsOpen}
          />
          <SignaturesDialog
            documentId={id}
            open={signaturesOpen}
            onOpenChange={setSignaturesOpen}
          />
        </>
      )}
      <TemplateEditor
        backHref="/documents"
        onShare={() => setShareOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onComments={() => setCommentsOpen(true)}
        onSignatures={() => setSignaturesOpen(true)}
        persistence={{
        mode: 'bound',
        initial: {
          templateId: data.templateId,
          title: doc.title,
          html: data.html ?? '<p></p>',
          values: data.values ?? {},
          pageSize: doc.pageSize,
        },
        onSave: handleSave,
        onPageSizeChange: (size) => patch.mutate({ pageSize: size }),
        savedAt,
        saving: patch.isPending,
      }}
        onAiGenerate={handleAiGenerate}
        onAiRevise={handleAiRevise}
        onExportPdf={() => startExport()}
        exportingPdf={exportState.phase === 'queued'}
      />
    </>
  );
}
