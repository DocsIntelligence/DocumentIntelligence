import type { VaultBadgeVariant, VaultEntityKindConfig } from '@org/api-client';

/**
 * Static fallback labels for the 7 system kinds — used before the API
 * `entityKinds()` query returns, and as a last-resort for any kind that
 * isn't found in the dynamic list (defensive — shouldn't normally happen).
 */
export const KIND_LABEL: Record<string, string> = {
  person: 'Person',
  company: 'Company',
  lawyer: 'Lawyer',
  court: 'Court',
  case: 'Case',
  property: 'Property',
  other: 'Other',
};

/**
 * Static fallback badge variant per system kind. The DB-driven kinds also
 * carry a `badgeVariant`, which takes precedence when available.
 */
export const KIND_BADGE: Record<string, VaultBadgeVariant> = {
  person: 'primary',
  company: 'secondary',
  lawyer: 'info',
  court: 'warning',
  case: 'info',
  property: 'success',
  other: 'secondary',
};

/** Stable display order for the static system kinds (frequency-of-use). */
export const KIND_ORDER: string[] = [
  'person',
  'company',
  'lawyer',
  'court',
  'case',
  'property',
  'other',
];

/**
 * Resolve a label for a kind key, preferring the dynamic list (which
 * includes any admin-added kinds) and falling back to the static map.
 */
export function labelFor(
  kindKey: string,
  dynamic?: VaultEntityKindConfig[],
): string {
  const found = dynamic?.find((k) => k.key === kindKey);
  return found?.label ?? KIND_LABEL[kindKey] ?? kindKey;
}

/** Resolve a badge variant for a kind, same precedence as labelFor. */
export function badgeFor(
  kindKey: string,
  dynamic?: VaultEntityKindConfig[],
): VaultBadgeVariant {
  const found = dynamic?.find((k) => k.key === kindKey);
  return (found?.badgeVariant ?? KIND_BADGE[kindKey] ?? 'secondary') as VaultBadgeVariant;
}
