import type { VaultEntityKind } from '@org/api-client';

/** Human-readable label per vault entity kind. */
export const KIND_LABEL: Record<VaultEntityKind, string> = {
  person: 'Person',
  company: 'Company',
  lawyer: 'Lawyer',
  court: 'Court',
  case: 'Case',
  property: 'Property',
  other: 'Other',
};

/**
 * Badge variant per kind — keeps the row badge colour stable so a glance
 * tells the user what type they're looking at. Shared between the list,
 * detail and autofill picker so all three use the same colour story.
 */
export const KIND_BADGE: Record<
  VaultEntityKind,
  'primary' | 'secondary' | 'info' | 'warning' | 'success'
> = {
  person: 'primary',
  company: 'secondary',
  lawyer: 'info',
  court: 'warning',
  case: 'info',
  property: 'success',
  other: 'secondary',
};

/** Stable order for create/filter pickers — frequency-of-use first. */
export const KIND_ORDER: VaultEntityKind[] = [
  'person',
  'company',
  'lawyer',
  'court',
  'case',
  'property',
  'other',
];
