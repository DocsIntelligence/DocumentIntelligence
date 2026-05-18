import type { DocumentTypeBundle } from './types';

/**
 * In-process registry of DocumentType bundles. Populated by side-effecting
 * imports from each document-type module. Consumers go through the lookup
 * helpers, not the registry directly.
 */
const registry = new Map<string, DocumentTypeBundle>();

export function registerDocumentType(bundle: DocumentTypeBundle): void {
  const existing = registry.get(bundle.key);
  if (existing) {
    // Tolerate idempotent re-registration; reject true conflicts.
    if (existing !== bundle) {
      throw new Error(
        `DocumentType "${bundle.key}" registered twice with different bundles`,
      );
    }
    return;
  }
  registry.set(bundle.key, bundle);
}

export function getBundle<T = unknown>(
  key: string,
): DocumentTypeBundle<T> | undefined {
  return registry.get(key) as DocumentTypeBundle<T> | undefined;
}

export function requireBundle<T = unknown>(key: string): DocumentTypeBundle<T> {
  const b = getBundle<T>(key);
  if (!b) throw new Error(`Unknown DocumentType: ${key}`);
  return b;
}

export function listRegisteredKeys(): string[] {
  return [...registry.keys()];
}
