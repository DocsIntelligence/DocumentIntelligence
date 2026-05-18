import { PageSize } from '@prisma/client';

/**
 * Seed registry of legal document types and their default system-owned
 * templates. The `schema` field carries a JSON snapshot of the Zod schema
 * shape — used for runtime validation contexts that can't import the
 * TypeScript schema lib. The real source of truth is libs/document-schema.
 *
 * Keep this list curated. Adding a row here is a product decision, not a
 * developer convenience.
 */

export type DocumentTemplateSeed = {
  key: string;
  name: string;
  componentKey: string;
  language: string;
  jurisdictions: string[];
  isPremium?: boolean;
};

export type DocumentTypeSeed = {
  key: string;
  name: string;
  category: string;
  description: string;
  defaultPageSize: PageSize;
  jurisdictions: string[];
  iconKey?: string;
  sortOrder: number;
  schemaShape: Record<string, unknown>; // placeholder for serialized Zod
  templates: DocumentTemplateSeed[];
};

export const documentTypes: DocumentTypeSeed[] = [
  {
    key: 'rent_agreement',
    name: 'Rent Agreement',
    category: 'tenancy',
    description:
      'Residential or commercial rent agreement, with optional stamp-paper printing and state-specific clauses.',
    defaultPageSize: PageSize.stamp_paper_in_500,
    jurisdictions: ['IN-MH', 'IN-KA', 'IN-DL', 'IN-TN', 'IN-UP', 'IN-*'],
    iconKey: 'home',
    sortOrder: 10,
    schemaShape: {
      sections: [
        'parties',
        'property',
        'term',
        'rent_deposit',
        'utilities',
        'rules',
        'witnesses',
      ],
    },
    templates: [
      {
        key: 'rent-classic',
        name: 'Classic (English)',
        componentKey: 'rent-agreement.classic',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
      {
        key: 'rent-bilingual',
        name: 'Bilingual (Hindi / Marathi heading)',
        componentKey: 'rent-agreement.bilingual',
        language: 'en',
        jurisdictions: ['IN-MH', 'IN-DL', 'IN-UP'],
      },
    ],
  },
  {
    key: 'rti',
    name: 'RTI Application',
    category: 'info_rights',
    description:
      'Right to Information application under RTI Act 2005. Auto-routes to the correct PIO based on the selected department.',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'file-search',
    sortOrder: 20,
    schemaShape: {
      sections: ['applicant', 'department', 'pio', 'questions', 'fee'],
    },
    templates: [
      {
        key: 'rti-default-en',
        name: 'RTI (English)',
        componentKey: 'rti.default',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
      {
        key: 'rti-default-hi',
        name: 'RTI (Hindi)',
        componentKey: 'rti.default',
        language: 'hi',
        jurisdictions: ['IN-*'],
      },
    ],
  },
  {
    key: 'legal_notice',
    name: 'Legal Notice',
    category: 'notices',
    description:
      'Pre-litigation legal notice. Variants for consumer, employment, civil, and cheque-bounce (NI §138).',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'gavel',
    sortOrder: 30,
    schemaShape: {
      sections: ['sender', 'recipient', 'subject', 'facts', 'demand', 'cause_of_action'],
    },
    templates: [
      {
        key: 'notice-formal',
        name: 'Formal (English)',
        componentKey: 'legal-notice.formal',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
    ],
  },
];
