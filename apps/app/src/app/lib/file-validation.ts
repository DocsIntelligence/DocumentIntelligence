/**
 * Client-side validation for document uploads (Document Intelligence). The
 * `accept` attribute only filters the OS picker — it doesn't stop drag-drop or
 * programmatic selection, and it can't enforce a size cap. This gives the
 * upload forms real, field-level rejection with reasons to surface inline.
 */

export const ACCEPTED_DOC_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
] as const;

export const ACCEPTED_DOC_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'image/png',
  'image/jpeg',
] as const;

/** Picker `accept` string (extensions + mime), shared by the upload forms. */
export const DOC_ACCEPT = [...ACCEPTED_DOC_EXTENSIONS, ...ACCEPTED_DOC_MIME].join(
  ',',
);

export const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export type FileRejectReason = 'type' | 'size' | 'empty';

export interface FileRejection {
  file: File;
  reason: FileRejectReason;
}

function hasAcceptedType(file: File): boolean {
  const name = file.name.toLowerCase();
  const extOk = ACCEPTED_DOC_EXTENSIONS.some((ext) => name.endsWith(ext));
  // Some browsers leave `type` empty (e.g. .md); fall back to extension.
  const mimeOk = !file.type || ACCEPTED_DOC_MIME.includes(file.type as never);
  return extOk && mimeOk;
}

/** Validate one file; returns the reject reason, or null when acceptable. */
export function validateDocumentFile(file: File): FileRejectReason | null {
  if (file.size === 0) return 'empty';
  if (file.size > MAX_FILE_SIZE_BYTES) return 'size';
  if (!hasAcceptedType(file)) return 'type';
  return null;
}

/** Split a list into accepted files and rejections (with reasons). */
export function partitionDocumentFiles(files: File[]): {
  accepted: File[];
  rejected: FileRejection[];
} {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  for (const file of files) {
    const reason = validateDocumentFile(file);
    if (reason) rejected.push({ file, reason });
    else accepted.push(file);
  }
  return { accepted, rejected };
}
