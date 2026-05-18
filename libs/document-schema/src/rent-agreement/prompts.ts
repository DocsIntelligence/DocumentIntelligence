import type { PromptManifest } from '../types';

/**
 * Versioned prompts for rent-agreement AI assists. The `id` is referenced
 * from form-metadata (aiPromptKey). Bump `version` on any content change.
 *
 * Placeholders in `user` use {{handlebars}}. The legal-ai service fills
 * them at execution time. Disclaimer appending happens in the guard layer,
 * not here.
 */

export const rentAgreementPrompts: PromptManifest = {
  'clause.rewrite': {
    id: 'clause.rewrite',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.4,
    system:
      'You are a contract-drafting assistant for Indian residential rent agreements. ' +
      'Rewrite clauses in clear, formal English with no legalese where avoidable. ' +
      'Preserve all rights, obligations, and amounts. Output only the rewritten clause; ' +
      'do not include explanations.',
    user:
      'Rewrite the following rent-agreement clause in a {{tone}} tone, optimised for ' +
      '{{audience}} ({{jurisdiction}}).\n\nClause:\n{{clause}}',
  },

  'rules.suggest': {
    id: 'rules.suggest',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.5,
    system:
      'You suggest fair house-rule clauses for Indian residential tenancies. ' +
      'Return 3 to 5 short rule sentences as a JSON array of strings. ' +
      'Avoid clauses that violate Maharashtra/Karnataka rent law. No commentary.',
    user:
      'Property type: {{propertyType}}\nFurnishing: {{furnished}}\nCity: {{city}}\n' +
      'Existing rules: {{existingRules}}\n\nSuggest additional house rules suitable ' +
      'for this property.',
  },

  'term.lockin_explain': {
    id: 'term.lockin_explain',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You explain lease terms to non-lawyers. Be concise (≤ 80 words). No legal advice.',
    user:
      'Explain in plain English what a {{months}}-month lock-in means in a rent ' +
      'agreement, and what happens if the tenant leaves early.',
  },

  'parties.parent_format': {
    id: 'parties.parent_format',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.1,
    system:
      'You format Indian legal-document party-name strings. Return only the formatted ' +
      'string, no prose.',
    user: 'Given relation={{relation}} and parent name={{parentName}}, output the ' +
      'standard form (e.g. "S/o Ramesh Kumar").',
  },

  'doc.missing_clause_scan': {
    id: 'doc.missing_clause_scan',
    version: '2026-01-01',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    system:
      'You audit an Indian rent agreement for missing essential clauses. ' +
      'Return a JSON array of {clauseName, importance: "high"|"medium", reason}. ' +
      'Do not include clauses that already exist. Max 8 items.',
    user: 'Existing clauses (titles only):\n{{existingClauses}}\n\nState: {{state}}',
  },
};
