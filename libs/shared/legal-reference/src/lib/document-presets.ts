/**
 * Court & legal document presets — frontend-safe catalog used by the
 * New-document picker. Each preset seeds an AI draft (a `sampleBrief` the user
 * edits) and carries a `key` the backend maps to a structural prompt scaffold
 * (see apps/api .../legal-ai/court-scaffolds.ts). Prompt internals stay
 * server-side; only this lightweight metadata is shared with the client.
 */

export type DocumentPresetCategory =
  | 'Notices'
  | 'Court Filings'
  | 'Affidavits'
  | 'Agreements'
  | 'Personal'
  | 'Information';

export interface DocumentPreset {
  key: string;
  name: string;
  category: DocumentPresetCategory;
  description: string;
  /** Editable starter brief shown in the AI draft modal. */
  sampleBrief: string;
  /** Citation topics (from the citation library) relevant to this document. */
  citationTopics?: string[];
}

export const DOCUMENT_PRESETS: DocumentPreset[] = [
  {
    key: 'legal-notice-138',
    name: 'Cheque bounce notice (NI §138)',
    category: 'Notices',
    description:
      'Statutory demand notice for a dishonoured cheque under the Negotiable Instruments Act.',
    sampleBrief:
      'Cheque bounce notice. Drawer: {{drawer_name}}, {{drawer_address}}. Payee: {{payee_name}}. Cheque no. {{cheque_number}} dated {{cheque_date}} for ₹{{cheque_amount}}, drawn on {{bank_name}}, dishonoured on {{dishonour_date}} for "{{return_reason}}". Demand payment within 15 days.',
    citationTopics: ['cheque-bounce', 'notice'],
  },
  {
    key: 'legal-notice-general',
    name: 'Legal / demand notice',
    category: 'Notices',
    description:
      'A pre-litigation legal notice (recovery, breach, employment, civil).',
    sampleBrief:
      'Legal notice from {{sender_name}} to {{recipient_name}}, {{recipient_address}}, regarding {{subject}}. Facts: {{facts}}. Demand: {{demand}} within {{notice_period}} days, failing which legal action will follow.',
  },
  {
    key: 'consumer-complaint',
    name: 'Consumer complaint (CPA 2019)',
    category: 'Court Filings',
    description:
      'Complaint before a Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019.',
    sampleBrief:
      'Consumer complaint. Complainant: {{complainant_name}}, {{complainant_address}}. Opposite party: {{opposite_party}}. Goods/services: {{product_or_service}} purchased on {{purchase_date}} for ₹{{amount}}. Deficiency/defect: {{grievance}}. Relief sought: refund/replacement/compensation of ₹{{relief_amount}}.',
    citationTopics: ['consumer'],
  },
  {
    key: 'bail-regular',
    name: 'Regular bail application (BNSS)',
    category: 'Court Filings',
    description:
      'Application for regular bail. Cites current BNSS provisions (not the repealed CrPC).',
    sampleBrief:
      'Regular bail application for {{accused_name}} in FIR/Case No. {{case_number}}, P.S. {{police_station}}, under {{offence_sections}}. Accused in custody since {{custody_date}}. Grounds: {{grounds}}.',
    citationTopics: ['bail', 'criminal'],
  },
  {
    key: 'bail-anticipatory',
    name: 'Anticipatory bail application (BNSS)',
    category: 'Court Filings',
    description:
      'Pre-arrest bail application under the BNSS (successor to CrPC §438).',
    sampleBrief:
      'Anticipatory bail application for {{applicant_name}} apprehending arrest in FIR No. {{case_number}}, P.S. {{police_station}}, under {{offence_sections}}. Grounds: {{grounds}}. Applicant undertakes to cooperate with investigation.',
    citationTopics: ['bail', 'criminal'],
  },
  {
    key: 'plaint',
    name: 'Plaint (civil suit)',
    category: 'Court Filings',
    description:
      'Plaint instituting a civil suit (recovery, declaration, injunction, specific performance).',
    sampleBrief:
      'Plaint. Plaintiff: {{plaintiff_name}}, {{plaintiff_address}}. Defendant: {{defendant_name}}, {{defendant_address}}. Suit for {{relief}}. Facts/cause of action: {{facts}}. Suit valuation: ₹{{suit_value}}.',
  },
  {
    key: 'written-statement',
    name: 'Written statement (defence)',
    category: 'Court Filings',
    description:
      'Defendant’s written statement replying to a plaint, with preliminary objections and para-wise reply.',
    sampleBrief:
      'Written statement on behalf of defendant {{defendant_name}} in Suit No. {{suit_number}} filed by {{plaintiff_name}}. Preliminary objections: {{objections}}. Para-wise reply and defence: {{defence}}.',
  },
  {
    key: 'vakalatnama',
    name: 'Vakalatnama',
    category: 'Court Filings',
    description:
      'Authorisation appointing an advocate to act in a case.',
    sampleBrief:
      'Vakalatnama appointing Advocate {{advocate_name}} (Enrolment No. {{bar_number}}) to appear for {{client_name}} in Case No. {{case_number}} before {{court_name}}.',
  },
  {
    key: 'affidavit-general',
    name: 'Affidavit',
    category: 'Affidavits',
    description:
      'General sworn affidavit (name change, address proof, lost document, declaration).',
    sampleBrief:
      'Affidavit of {{deponent_name}}, aged {{age}}, resident of {{address}}. I solemnly affirm and declare that {{statement}}.',
  },
  {
    key: 'rti-application',
    name: 'RTI application',
    category: 'Information',
    description:
      'Application under the Right to Information Act, 2005 to a Public Information Officer.',
    sampleBrief:
      'RTI application to the PIO, {{department}}. Applicant: {{applicant_name}}, {{applicant_address}}. Information sought: {{questions}}. Period: {{period}}.',
    citationTopics: ['rti'],
  },
  {
    key: 'writ-petition',
    name: 'Writ petition (Art. 226/32)',
    category: 'Court Filings',
    description:
      'Writ petition before a High Court (Art. 226) or the Supreme Court (Art. 32).',
    sampleBrief:
      'Writ petition by {{petitioner_name}} against {{respondent_name}} ({{authority}}). Relief: a writ of {{writ_type}} (mandamus/certiorari/etc.). Grounds: {{grounds}}. Fundamental/legal right affected: {{right}}.',
  },

  // ── Agreements ────────────────────────────────────────────────────────────
  {
    key: 'nda',
    name: 'Non-disclosure agreement (NDA)',
    category: 'Agreements',
    description: 'Mutual or one-way confidentiality agreement.',
    sampleBrief:
      'NDA between {{party_a}} and {{party_b}} for the purpose of {{purpose}}. Term: {{term}}. Mutual: {{mutual_yesno}}. Governing law: {{governing_state}}, India.',
  },
  {
    key: 'mou',
    name: 'Memorandum of understanding (MoU)',
    category: 'Agreements',
    description: 'Non-binding (or partly binding) understanding between parties.',
    sampleBrief:
      'MoU between {{party_a}} and {{party_b}} regarding {{subject}}. Scope: {{scope}}. Responsibilities: {{responsibilities}}. Duration: {{duration}}.',
  },
  {
    key: 'partnership-deed',
    name: 'Partnership deed',
    category: 'Agreements',
    description: 'Deed constituting a partnership firm (Indian Partnership Act, 1932).',
    sampleBrief:
      'Partnership deed for firm "{{firm_name}}" at {{firm_address}}. Partners: {{partners}}. Capital contributions: {{capital}}. Profit/loss sharing: {{profit_ratio}}. Business: {{business}}.',
  },
  {
    key: 'offer-letter',
    name: 'Employment offer letter',
    category: 'Agreements',
    description: 'Offer of employment with role, compensation, and start date.',
    sampleBrief:
      'Employment offer from {{company_name}} to {{candidate_name}} for the role of {{job_title}}. CTC ₹{{ctc}}/year. Start date: {{start_date}}. Probation: {{probation}} months. Location: {{location}}.',
  },
  {
    key: 'gift-deed',
    name: 'Gift deed',
    category: 'Agreements',
    description:
      'Voluntary transfer of property by gift. Immovable-property gifts require registration; NOT eligible for Aadhaar eSign (IT Act Schedule 1).',
    sampleBrief:
      'Gift deed by donor {{donor_name}} to donee {{donee_name}} ({{relationship}}) of {{property_description}}. Consideration: love and affection (no monetary consideration).',
    citationTopics: ['registration'],
  },

  // ── Personal ────────────────────────────────────────────────────────────
  {
    key: 'will',
    name: 'Will / testament',
    category: 'Personal',
    description:
      'Last will and testament. NOT eligible for Aadhaar eSign (IT Act Schedule 1); requires two witnesses.',
    sampleBrief:
      'Will of {{testator_name}}, aged {{age}}, resident of {{address}}. Executor: {{executor_name}}. Beneficiaries and bequests: {{bequests}}. Revokes all earlier wills.',
  },
  {
    key: 'gpa',
    name: 'Power of attorney',
    category: 'Personal',
    description:
      'General/special power of attorney. NOT eligible for Aadhaar eSign (IT Act Schedule 1); often requires notarisation/registration.',
    sampleBrief:
      'Power of attorney by {{principal_name}} appointing {{attorney_name}} ({{relationship}}) to act for {{purpose}}. Powers: {{powers}}. General or special: {{type}}.',
  },
];

const BY_KEY = new Map(DOCUMENT_PRESETS.map((p) => [p.key, p]));

export function getDocumentPreset(key: string): DocumentPreset | undefined {
  return BY_KEY.get(key);
}
