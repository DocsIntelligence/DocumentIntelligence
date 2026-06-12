import type { PromptManifest } from '../types';

/**
 * One assist: turn a few notes into a crisp role-summary paragraph for the
 * offer letter. The AI does not set compensation, statutory terms, or legal
 * obligations — those come from the form/template.
 */
export const employmentOfferPrompts: PromptManifest = {
  'offer.role_summary': {
    id: 'offer.role_summary',
    version: '2026-06-12',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    system:
      'You write a short, warm-but-professional role summary for an employment ' +
      'offer letter. 2–3 sentences describing the role and its scope. No ' +
      'compensation figures, no legal/statutory terms. Return only the prose.',
    user: 'Title: {{title}}\nDepartment: {{department}}\nNotes:\n{{notes}}\n\nReturn the role summary.',
  },
};
