import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSignatureAuditHtml,
  buildSignatureBlockHtml,
  type SignatureSignerInput,
} from '@org/legal-reference';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PageLoader } from '@org/ui';
import { TemplateEditor, type EditorDraftState } from './TemplateEditor';
import type { PlaceholderDef } from './templates/types';
import {
  useDocument,
  usePatchDocument,
  useSigners,
} from '../documents/queries';
import { useLegalAiService } from '../documents/services-context';
import { useExportPdf } from '../documents/builder/useExportPdf';
import { SignaturesDialog } from '../documents/SignaturesDialog';

/** Surface repealed-code (IPC/CrPC/Evidence) citation warnings from the API. */
export function warnCitations(warnings?: string[]) {
  if (warnings && warnings.length) {
    toast.warning('Check statutory citations', {
      description: warnings.join('\n'),
      duration: 10_000,
    });
  }
}

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
  const [signaturesOpen, setSignaturesOpen] = useState(false);

  // Captured signatures → rendered into the live preview (and the PDF via the
  // backend render-payload) so they appear on the document.
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
      patch.mutate(
        {
          title: s.title,
          data: {
            html: s.html,
            values: s.values,
            templateId: s.templateId,
            fontFamily: s.fontFamily,
            fields: s.fields,
          },
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
    fontFamily?: string;
    fields?: PlaceholderDef[];
  };

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
        backHref="/documents"
        documentId={id}
        onSignatures={() => setSignaturesOpen(true)}
        previewAppendHtml={signaturesHtml}
        persistence={{
          mode: 'bound',
          initial: {
            templateId: data.templateId,
            title: doc.title,
            html: data.html ?? '<p></p>',
            values: data.values ?? {},
            pageSize: doc.pageSize,
            fontFamily: data.fontFamily,
            fields: data.fields,
            headerText: doc.headerText,
            footerText: doc.footerText,
          },
          onSave: handleSave,
          onPageSizeChange: (size) => patch.mutate({ pageSize: size }),
          onHeaderFooterChange: (v) => patch.mutate(v),
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
