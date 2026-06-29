import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageLoader } from '@org/ui';
import {
  buildSignatureAuditHtml,
  buildSignatureBlockHtml,
  type SignatureSignerInput,
} from '@org/legal-reference';
import { freeformDocumentDataSchema, type FreeformDocumentData } from '@org/dto';
import { TemplateEditor, type EditorDraftState } from '../TemplateEditor';
import { warnCitations } from '../DraftEditorPage';
import {
  useDocument,
  usePatchDocument,
  useSigners,
} from '../../documents/queries';
import { useLegalAiService } from '../../documents/services-context';
import { useExportPdf } from '../../documents/builder/useExportPdf';
import { SignaturesDialog } from '../../documents/SignaturesDialog';

/**
 * `/documents/:id/markdown` — the Markdown editor bound to a backend Document.
 * Same full-featured shell as the freeform draft editor (AI, PDF/Word export,
 * signatures, history/comments/share), but `editorKind="markdown"`: the
 * Markdown source is canonical and the rendered `html` is kept in sync so the
 * PDF / share / signature pipeline keeps working.
 */
export function MarkdownDraftPage() {
  const { id } = useParams<{ id: string }>();
  const { data: doc, isLoading, isError } = useDocument(id);
  const patch = usePatchDocument(id ?? '');
  const legalAi = useLegalAiService();
  const { state: exportState, start: startExport } = useExportPdf(id ?? '');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [signaturesOpen, setSignaturesOpen] = useState(false);

  // Captured signatures → rendered into the live preview (and the PDF render
  // payload) so they appear on the document, same as the freeform editor.
  const signers = useSigners(id ?? '', !!id);
  const signaturesHtml = useMemo(() => {
    const list = signers.data ?? [];
    if (!list.length) return undefined;
    const str = (v: unknown) => (typeof v === 'string' ? v : null);
    const mapped: SignatureSignerInput[] = list.map((s) => {
      const ev = (s.evidence ?? {}) as Record<string, unknown>;
      return {
        name: s.name,
        email: s.email,
        role: s.role,
        status: s.status,
        method: s.provider ?? str(ev.method),
        image: str(ev.image),
        typedText: str(ev.typedText),
        font: str(ev.font),
        signedAt: s.signedAt ?? str(ev.signedAt),
        ip: str(ev.ip),
        userAgent: str(ev.userAgent),
      };
    });
    return buildSignatureBlockHtml(mapped) + buildSignatureAuditHtml(mapped);
  }, [signers.data]);

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
      warnCitations(r.citationWarnings);
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
      warnCitations(r.citationWarnings);
      return { html: r.html };
    },
    [legalAi, docTypeKey],
  );

  const handleSave = useCallback(
    (s: EditorDraftState) => {
      const data = {
        format: 'markdown',
        markdown: s.markdown ?? '',
        html: s.html,
        values: s.values,
        templateId: s.templateId,
        fontFamily: s.fontFamily,
        fields: s.fields,
      } satisfies FreeformDocumentData;
      patch.mutate(
        { title: s.title, data },
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

  // Validate the persisted blob against the shared schema; tolerate legacy docs.
  const parsed = freeformDocumentDataSchema.safeParse(doc.data ?? {});
  const data: FreeformDocumentData = parsed.success
    ? parsed.data
    : { html: '', markdown: '' };

  return (
    <>
      {id && (
        <SignaturesDialog
          documentId={id}
          open={signaturesOpen}
          onOpenChange={setSignaturesOpen}
          docTypeKey={doc?.documentType?.key}
        />
      )}
      <TemplateEditor
        editorKind="markdown"
        backHref="/documents"
        documentId={id}
        onSignatures={() => setSignaturesOpen(true)}
        previewAppendHtml={signaturesHtml}
        persistence={{
          mode: 'bound',
          initial: {
            templateId: data.templateId,
            title: doc.title,
            html: data.html,
            markdown: data.markdown ?? '',
            values: data.values ?? {},
            pageSize: doc.pageSize,
            fontFamily: data.fontFamily,
            fields: data.fields,
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
