import { z } from 'zod';

/**
 * Document export formats rendered server-side (Puppeteer over the artboard):
 *   - `pdf`  — print-ready PDF (the default).
 *   - `png`  — a full-page image of the rendered document.
 *   - `docx` — true OOXML Word document, built from the rendered HTML via
 *     html-to-docx (Word/Google-Docs open + edit it natively). This supersedes
 *     the legacy client-side `.doc` (HTML-wrapped `application/msword`) for the
 *     builder; the client `.doc` path still exists for the standalone editor.
 *
 * Single source of truth — the API DTO, the renderer payload and the API client
 * all derive their format type from this enum instead of inlining the union.
 */
export const EXPORT_FORMATS = ['pdf', 'png', 'docx'] as const;

export const exportFormatSchema = z.enum(EXPORT_FORMATS);

export type ExportFormat = z.infer<typeof exportFormatSchema>;
