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
      sections: [
        'sender',
        'recipient',
        'subject',
        'facts',
        'demand',
        'cause_of_action',
      ],
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
  {
    key: 'affidavit',
    name: 'Affidavit',
    category: 'declarations',
    description:
      'General-purpose sworn affidavit — name/address/DOB, income, gap, lost-document and similar declarations, with notary/oath-commissioner attestation.',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'file-check',
    sortOrder: 40,
    schemaShape: {
      sections: ['deponent', 'declaration', 'attestation'],
    },
    templates: [
      {
        key: 'affidavit-default-en',
        name: 'General Affidavit (English)',
        componentKey: 'affidavit.default',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
    ],
  },
  {
    key: 'nda',
    name: 'Non-Disclosure Agreement',
    category: 'contracts',
    description:
      'Mutual or one-way confidentiality agreement (Indian Contract Act, 1872). Defines confidential information, exclusions, obligations, term/survival, and governing law.',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'lock',
    sortOrder: 50,
    schemaShape: {
      sections: ['agreement', 'partyA', 'partyB', 'terms', 'governing', 'witnesses'],
    },
    templates: [
      {
        key: 'nda-standard',
        name: 'Standard NDA (English)',
        componentKey: 'nda.standard',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
    ],
  },
  {
    key: 'promissory_note',
    name: 'Promissory Note',
    category: 'contracts',
    description:
      'Unconditional promise to pay a sum of money (Negotiable Instruments Act, 1881 §4). Must be stamped; cannot be eSigned (IT Act Schedule 1).',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'banknote',
    sortOrder: 60,
    schemaShape: {
      sections: ['note', 'maker', 'payee', 'witnesses'],
    },
    templates: [
      {
        key: 'pronote-standard',
        name: 'Promissory Note (English)',
        componentKey: 'promissory-note.standard',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
    ],
  },
  {
    key: 'employment_offer',
    name: 'Employment Offer Letter',
    category: 'hr',
    description:
      'Offer of employment with role, compensation, and terms. Works for India and globally (currency + optional at-will term).',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*', 'GLOBAL'],
    iconKey: 'briefcase',
    sortOrder: 70,
    schemaShape: {
      sections: ['offer', 'company', 'candidate', 'role', 'compensation', 'terms'],
    },
    templates: [
      {
        key: 'offer-standard',
        name: 'Offer Letter (English)',
        componentKey: 'employment-offer.standard',
        language: 'en',
        jurisdictions: ['IN-*', 'GLOBAL'],
      },
    ],
  },
  {
    key: 'power_of_attorney',
    name: 'Power of Attorney',
    category: 'authorisations',
    description:
      'General or Special Power of Attorney (Powers-of-Attorney Act, 1882). Often needs notarisation/registration; cannot be eSigned (IT Act Schedule 1).',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'scroll',
    sortOrder: 80,
    schemaShape: {
      sections: ['poa', 'principal', 'attorney', 'powers', 'terms', 'witnesses'],
    },
    templates: [
      {
        key: 'poa-standard',
        name: 'Power of Attorney (English)',
        componentKey: 'power-of-attorney.standard',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
    ],
  },
  {
    key: 'invoice',
    name: 'Invoice',
    category: 'business',
    description:
      'Full tax invoice — line items, per-item GST (CGST/SGST/IGST) or single tax or none, inclusive/exclusive pricing, discounts, multi-currency, computed totals and amount in words.',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*', 'GLOBAL'],
    iconKey: 'receipt',
    sortOrder: 90,
    schemaShape: {
      sections: ['invoice', 'seller', 'buyer', 'items', 'summary', 'payment', 'notes'],
    },
    templates: [
      {
        key: 'invoice-standard',
        name: 'Standard Invoice',
        componentKey: 'invoice.standard',
        language: 'en',
        jurisdictions: ['IN-*', 'GLOBAL'],
      },
    ],
  },
  {
    key: 'freeform',
    name: 'Freeform / AI Draft',
    category: 'general',
    description:
      'Free-form document drafted in the rich-text editor or generated by AI. No fixed schema — the body is edited directly as HTML.',
    defaultPageSize: PageSize.a4,
    jurisdictions: ['IN-*'],
    iconKey: 'file-text',
    sortOrder: 100,
    schemaShape: { sections: [] },
    templates: [
      {
        key: 'freeform',
        name: 'Freeform',
        componentKey: 'freeform',
        language: 'en',
        jurisdictions: ['IN-*'],
      },
    ],
  },
];
