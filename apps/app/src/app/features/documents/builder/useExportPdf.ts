import type { DocumentExportStatus } from '@org/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useDocumentsService } from '../services-context';

type ExportState =
  | { phase: 'idle' }
  | { phase: 'queued'; exportId: string }
  | { phase: 'ready'; exportId: string; url: string }
  | { phase: 'failed'; error: string };

/**
 * Hook that owns the lifecycle of one PDF export:
 *   1. POST /documents/:id/exports → exportId
 *   2. poll GET /documents/:id/exports/:exportId every 1500ms
 *   3. when status=ready → fetch presigned download URL
 *
 * Polling stops on success, failure, or hook unmount.
 */
export function useExportPdf(documentId: string) {
  const docs = useDocumentsService();
  const [state, setState] = useState<ExportState>({ phase: 'idle' });
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  const start = useCallback(
    async (format: 'pdf' | 'png' | 'docx' = 'pdf') => {
      cancelled.current = false;
      setState({ phase: 'idle' });
      try {
        const exp = await docs.enqueueExport(documentId, { format });
        if (exp.status === 'failed') {
          setState({
            phase: 'failed',
            error: exp.error ?? 'Export failed before queueing.',
          });
          return;
        }
        setState({ phase: 'queued', exportId: exp.id });

        const final = await pollUntilTerminal(
          () => docs.getExport(documentId, exp.id),
          cancelled,
        );
        if (cancelled.current) return;
        if (final.status === 'failed') {
          setState({
            phase: 'failed',
            error: final.error ?? 'Export failed.',
          });
          return;
        }
        const dl = await docs.getExportDownload(documentId, exp.id);
        if (!dl.ready) {
          setState({
            phase: 'failed',
            error: dl.error ?? 'Could not fetch download URL.',
          });
          return;
        }
        setState({ phase: 'ready', exportId: exp.id, url: dl.url });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(`Export failed: ${msg}`);
        setState({ phase: 'failed', error: msg });
      }
    },
    [docs, documentId],
  );

  return { state, start };
}

async function pollUntilTerminal(
  fetcher: () => Promise<DocumentExportStatus>,
  cancelled: { current: boolean },
): Promise<DocumentExportStatus> {
  const maxAttempts = 40; // ~60s at 1500ms
  for (let i = 0; i < maxAttempts; i++) {
    if (cancelled.current) {
      throw new Error('Cancelled');
    }
    const exp = await fetcher();
    if (exp.status === 'ready' || exp.status === 'failed') {
      return exp;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Export timed out after 60 seconds');
}
