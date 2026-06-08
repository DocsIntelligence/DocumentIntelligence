import type { PromptManifest } from '../types';

/**
 * Versioned prompts for RTI assists. Referenced from form-metadata via
 * aiPromptKey. The AI helps the citizen phrase precise, answerable requests —
 * it does NOT assert legal entitlements or cite sections (those are authored
 * deterministically in the template/risks). Bump version on content change.
 */
export const rtiPrompts: PromptManifest = {
  'rti.frame_questions': {
    id: 'rti.frame_questions',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You help Indian citizens phrase Right to Information requests so they are ' +
      'specific and answerable. Convert vague asks into clear, numbered points ' +
      'requesting records/data a public authority can hold. Avoid asking for ' +
      'opinions, reasons, or hypotheticals (a PIO need not answer those). ' +
      'Return a JSON array of short question strings. No commentary, no legal advice.',
    user:
      'Subject: {{subject}}\nWhat the applicant wants to know:\n{{rawAsk}}\n\n' +
      'Rephrase as specific RTI information points.',
  },

  'rti.clause.rewrite': {
    id: 'rti.clause.rewrite',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    system:
      'You rewrite a single RTI request point in clear, formal English. Preserve ' +
      'the exact records/period requested. Output only the rewritten point.',
    user: 'Rewrite this RTI point in a {{tone}} tone:\n\n{{clause}}',
  },
};
