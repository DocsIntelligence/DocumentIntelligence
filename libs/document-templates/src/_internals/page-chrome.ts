/**
 * Resolve `{{pageNumber}}` / `{{totalPages}}` placeholders in a user-supplied
 * header/footer template. Shared by `Page` (artboard/PDF) and the app's
 * `PaginatedPreview` so both surfaces render identical text.
 */
export function resolvePageChromeText(
  template: string | null | undefined,
  pageNumber: number,
  totalPages: number,
): string {
  if (!template) return '';
  return template
    .replace(/\{\{\s*pageNumber\s*\}\}/g, String(pageNumber))
    .replace(/\{\{\s*totalPages\s*\}\}/g, String(totalPages));
}
