/**
 * Court & legal document presets — frontend-safe catalog used by the
 * New-document picker / "Draft with AI" page. Each preset seeds an AI draft (a
 * `sampleBrief` the user edits) and carries a `key` the backend maps to a
 * structural prompt scaffold (see apps/api .../legal-ai/court-scaffolds.ts).
 * Prompt internals stay server-side; only this lightweight metadata is shared
 * with the client.
 *
 * Future-proofing: presets are display/scaffold metadata only — they are NOT a
 * second source of truth. eSign-exclusion lives in `schedule1.ts`
 * (`isESignExcluded`); statutory text lives in `citations.ts`
 * (`citationTopics`). A preset just points at those. Keep it that way.
 */

export type DocumentPresetCategory =
  | 'Notices'
  | 'Court Filings'
  | 'Affidavits'
  | 'Agreements'
  | 'Business'
  | 'HR & Corporate'
  | 'Personal'
  | 'Information';

export interface DocumentPreset {
  key: string;
  name: string;
  category: DocumentPresetCategory;
  description: string;
  /** Editable starter brief shown in the AI draft modal. */
  sampleBrief: string;
  /**
   * Human-readable governing law shown as a chip in the picker (e.g.
   * "Negotiable Instruments Act, 1881 §138"). Display only — the authoritative,
   * dated citation data lives in `citations.ts`, keyed via `citationTopics`.
   */
  applicableLaw?: string;
  /** Citation topics (from the citation library) relevant to this document. */
  citationTopics?: string[];
  /** Free-text search/filter tags (synonyms users may type). */
  tags?: string[];
  /** Surface near the top of its category as a common pick. */
  popular?: boolean;
  /**
   * Optional key to a richer structured doc type once one exists. When set, the
   * picker can nudge the user toward "Start from a structured document type"
   * instead of freeform. Display/UX hint only.
   */
  structuredTypeKey?: string;
}

export const DOCUMENT_PRESETS: DocumentPreset[] = [
  // ── Notices ───────────────────────────────────────────────────────────────
  {
    key: 'legal-notice-138',
    name: 'Cheque bounce notice (NI §138)',
    category: 'Notices',
    description:
      'Statutory demand notice for a dishonoured cheque under the Negotiable Instruments Act.',
    sampleBrief:
      'Cheque bounce notice. Drawer: {{drawer_name}}, {{drawer_address}}. Payee: {{payee_name}}. Cheque no. {{cheque_number}} dated {{cheque_date}} for ₹{{cheque_amount}}, drawn on {{bank_name}}, dishonoured on {{dishonour_date}} per return memo for reason "{{return_reason}}". Demand repayment of the cheque amount within 15 days of receipt of this notice, failing which a complaint under §138 will be filed within the limitation period.',
    applicableLaw: 'Negotiable Instruments Act, 1881 §138 & §142',
    citationTopics: ['cheque-bounce', 'notice'],
    tags: ['cheque', 'bounce', 'dishonour', '138', 'demand'],
    popular: true,
    structuredTypeKey: 'legal_notice',
  },
  {
    key: 'legal-notice-general',
    name: 'Legal / demand notice',
    category: 'Notices',
    description:
      'A pre-litigation legal notice (recovery, breach, employment, civil).',
    sampleBrief:
      'Legal notice from {{sender_name}}, {{sender_address}} (through counsel, if any) to {{recipient_name}}, {{recipient_address}}, regarding {{subject}}. Facts in chronological order: {{facts}}. Demand: {{demand}} to be complied with within {{notice_period}} days of receipt, failing which my client will be constrained to initiate appropriate civil and/or criminal proceedings at the recipient\'s risk as to cost and consequences.',
    applicableLaw: 'Pre-litigation notice (CPC §80 where the State is a party)',
    tags: ['demand', 'recovery', 'breach', 'pre-litigation'],
    popular: true,
    structuredTypeKey: 'legal_notice',
  },
  {
    key: 'rent-eviction-notice',
    name: 'Eviction / vacate notice (tenant)',
    category: 'Notices',
    description:
      'Notice to a tenant to vacate / quit on expiry or breach of a tenancy.',
    sampleBrief:
      'Notice to vacate from landlord {{landlord_name}} to tenant {{tenant_name}} in respect of the premises at {{premises_address}}, let on a monthly tenancy / lease dated {{tenancy_date}} at ₹{{rent}} per month. Ground: {{ground}} (expiry of term / default in rent of ₹{{arrears}} / unauthorised use / sub-letting). The tenant is called upon to clear all arrears and hand over vacant peaceful possession within {{notice_period}} days, failing which eviction and recovery proceedings will follow.',
    applicableLaw:
      'Transfer of Property Act, 1882 §106 + the applicable State Rent Control Act',
    tags: ['eviction', 'vacate', 'quit', 'tenant', 'landlord', 'possession'],
  },
  {
    key: 'employment-termination-notice',
    name: 'Employment termination / show-cause notice',
    category: 'Notices',
    description:
      'Show-cause or termination notice from an employer to an employee.',
    sampleBrief:
      'Notice from {{company_name}} to {{employee_name}} (Emp. ID {{employee_id}}, designation {{designation}}). Subject: {{subject}} (misconduct / non-performance / abandonment / show-cause). Facts: {{facts}}. The employee is called upon to {{action_required}} within {{notice_period}} days / to show cause why disciplinary action should not be taken, failing which the company will proceed as per the appointment terms and applicable law.',
    applicableLaw: 'Terms of employment + Industrial Disputes Act, 1947 (where applicable)',
    tags: ['termination', 'show cause', 'employee', 'misconduct', 'hr'],
  },
  {
    key: 'public-notice',
    name: 'Public notice (newspaper)',
    category: 'Notices',
    description:
      'Public notice for a lost document, property title, name change, or change in firm constitution.',
    sampleBrief:
      'Public notice on behalf of {{name}}, {{address}}. Subject: {{subject}} (loss of original document / property purchase due-diligence / public objection invited). Details: {{details}}. Any person having any claim, objection or interest may communicate in writing to the undersigned / advocate within {{days}} days, failing which it will be presumed that no one has any claim.',
    applicableLaw: 'General — publication for notice to the public',
    tags: ['public notice', 'lost document', 'title search', 'objection'],
  },

  // ── Court Filings ──────────────────────────────────────────────────────────
  {
    key: 'consumer-complaint',
    name: 'Consumer complaint (CPA 2019)',
    category: 'Court Filings',
    description:
      'Complaint before a Consumer Disputes Redressal Commission under the Consumer Protection Act, 2019.',
    sampleBrief:
      'Consumer complaint. Complainant: {{complainant_name}}, {{complainant_address}}. Opposite party: {{opposite_party}}, {{op_address}}. Goods/services: {{product_or_service}} purchased on {{purchase_date}} for ₹{{amount}} (invoice {{invoice_no}}). Deficiency/defect: {{grievance}}. Cause of action arose on {{cause_date}} at {{place}}. Relief sought: refund/replacement and compensation of ₹{{relief_amount}} with costs.',
    applicableLaw: 'Consumer Protection Act, 2019',
    citationTopics: ['consumer'],
    tags: ['consumer', 'deficiency', 'refund', 'forum', 'commission'],
    popular: true,
  },
  {
    key: 'bail-regular',
    name: 'Regular bail application (BNSS)',
    category: 'Court Filings',
    description:
      'Application for regular bail. Cites current BNSS provisions (not the repealed CrPC).',
    sampleBrief:
      'Regular bail application for {{accused_name}}, S/o {{father_name}}, in FIR/Case No. {{case_number}}, P.S. {{police_station}}, for offences under {{offence_sections}}. Accused arrested/in custody since {{custody_date}}. Grounds: {{grounds}} (false implication / no recovery / investigation complete / parity / long custody). The applicant undertakes to abide by all conditions and not tamper with evidence or influence witnesses.',
    applicableLaw: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (successor to CrPC)',
    citationTopics: ['bail', 'criminal'],
    tags: ['bail', 'regular bail', 'bnss', 'custody', 'criminal'],
  },
  {
    key: 'bail-anticipatory',
    name: 'Anticipatory bail application (BNSS)',
    category: 'Court Filings',
    description:
      'Pre-arrest bail application under the BNSS (successor to CrPC §438).',
    sampleBrief:
      'Anticipatory bail application for {{applicant_name}} apprehending arrest in FIR No. {{case_number}}, P.S. {{police_station}}, for offences under {{offence_sections}}. Grounds: {{grounds}} (false / motivated complaint, custodial interrogation not required, cooperation offered). The applicant undertakes to join and cooperate with the investigation as and when required and not to leave India without permission.',
    applicableLaw:
      'Bharatiya Nagarik Suraksha Sanhita, 2023 §482 (successor to CrPC §438)',
    citationTopics: ['bail', 'criminal'],
    tags: ['anticipatory bail', 'pre-arrest', 'bnss', '482', 'criminal'],
  },
  {
    key: 'plaint',
    name: 'Plaint (civil suit)',
    category: 'Court Filings',
    description:
      'Plaint instituting a civil suit (recovery, declaration, injunction, specific performance).',
    sampleBrief:
      'Plaint. Plaintiff: {{plaintiff_name}}, {{plaintiff_address}}. Defendant: {{defendant_name}}, {{defendant_address}}. Suit for {{relief}} (recovery of ₹{{amount}} / declaration / permanent injunction / specific performance). Facts & cause of action (with dates): {{facts}}. Jurisdiction: {{jurisdiction_basis}}. Suit valuation: ₹{{suit_value}}; court fee paid accordingly. Limitation: the suit is within time.',
    applicableLaw: 'Code of Civil Procedure, 1908 (Order VII)',
    tags: ['plaint', 'civil suit', 'recovery', 'injunction', 'cpc'],
  },
  {
    key: 'written-statement',
    name: 'Written statement (defence)',
    category: 'Court Filings',
    description:
      'Defendant’s written statement replying to a plaint, with preliminary objections and para-wise reply.',
    sampleBrief:
      'Written statement on behalf of defendant {{defendant_name}} in Suit No. {{suit_number}} filed by {{plaintiff_name}}. Preliminary objections: {{objections}} (maintainability / limitation / cause of action / jurisdiction / non-joinder). Para-wise reply: {{para_reply}}. Defendant\'s own version & defence: {{defence}}. Prayer to dismiss the suit with costs.',
    applicableLaw: 'Code of Civil Procedure, 1908 (Order VIII)',
    tags: ['written statement', 'defence', 'reply', 'cpc'],
  },
  {
    key: 'vakalatnama',
    name: 'Vakalatnama',
    category: 'Court Filings',
    description: 'Authorisation appointing an advocate to act in a case.',
    sampleBrief:
      'Vakalatnama appointing Advocate {{advocate_name}} (Enrolment No. {{bar_number}}) to appear, act and plead for {{client_name}} in Case/Suit No. {{case_number}} before {{court_name}}, with authority to file and receive documents, lead evidence and compromise with the client\'s consent.',
    applicableLaw: 'Order III CPC / Bar Council of India Rules',
    tags: ['vakalatnama', 'advocate', 'authorisation', 'power'],
  },
  {
    key: 'writ-petition',
    name: 'Writ petition (Art. 226/32)',
    category: 'Court Filings',
    description:
      'Writ petition before a High Court (Art. 226) or the Supreme Court (Art. 32).',
    sampleBrief:
      'Writ petition by {{petitioner_name}} against {{respondent_name}} ({{authority}}). Relief: a writ of {{writ_type}} (mandamus / certiorari / prohibition / quo warranto / habeas corpus). Facts: {{facts}}. Grounds: {{grounds}}. Fundamental/legal right affected: {{right}}. No equally efficacious alternative remedy is available.',
    applicableLaw: 'Constitution of India, Art. 226 / Art. 32',
    tags: ['writ', 'mandamus', 'certiorari', 'high court', 'supreme court'],
  },
  {
    key: 'mutual-divorce-petition',
    name: 'Mutual-consent divorce petition',
    category: 'Court Filings',
    description:
      'Joint petition for divorce by mutual consent (Hindu Marriage Act §13B / Special Marriage Act §28).',
    sampleBrief:
      'Joint petition for divorce by mutual consent by {{spouse_1}} and {{spouse_2}}, married on {{marriage_date}} at {{marriage_place}} per {{marriage_rites}}. The parties have been living separately since {{separation_date}} and have not been able to live together; they have mutually agreed to dissolve the marriage. Terms of settlement (custody / maintenance / alimony / stridhan): {{settlement_terms}}.',
    applicableLaw: 'Hindu Marriage Act, 1955 §13B (or Special Marriage Act, 1954 §28)',
    tags: ['divorce', 'mutual consent', 'family', '13b', 'matrimonial'],
  },
  {
    key: 'maintenance-application',
    name: 'Maintenance application (BNSS §144)',
    category: 'Court Filings',
    description:
      'Application for maintenance of wife, children or parents (successor to CrPC §125).',
    sampleBrief:
      'Maintenance application by {{applicant_name}} against {{respondent_name}} ({{relationship}}). The respondent has sufficient means but neglects/refuses to maintain the applicant who is unable to maintain herself/himself. Monthly maintenance of ₹{{amount}} is claimed along with litigation expenses. Facts: {{facts}}.',
    applicableLaw:
      'Bharatiya Nagarik Suraksha Sanhita, 2023 §144 (successor to CrPC §125)',
    citationTopics: ['criminal'],
    tags: ['maintenance', 'wife', 'children', 'parents', '125', '144'],
  },
  {
    key: 'domestic-violence-complaint',
    name: 'Domestic violence application (PWDVA 2005)',
    category: 'Court Filings',
    description:
      'Application for protection/residence/monetary orders under the Protection of Women from Domestic Violence Act, 2005.',
    sampleBrief:
      'Application by aggrieved person {{applicant_name}} against respondent {{respondent_name}} ({{relationship}}) under the PWDVA, 2005. Domestic relationship: {{relationship_details}}. Acts of domestic violence (physical / emotional / economic / sexual): {{incidents}}. Reliefs sought: protection order, residence order, monetary relief of ₹{{amount}}, custody and compensation.',
    applicableLaw: 'Protection of Women from Domestic Violence Act, 2005',
    tags: ['domestic violence', 'pwdva', 'protection order', 'women', 'family'],
  },

  // ── Affidavits ─────────────────────────────────────────────────────────────
  {
    key: 'affidavit-general',
    name: 'Affidavit (general)',
    category: 'Affidavits',
    description:
      'General sworn affidavit (declaration, lost document, address proof, single status).',
    sampleBrief:
      'Affidavit of {{deponent_name}}, aged {{age}}, S/o/W/o/D/o {{parent_name}}, resident of {{address}}. I solemnly affirm and declare that: {{statements}}. This affidavit is made for {{purpose}}. Verified at {{place}} on {{date}}.',
    applicableLaw: 'Sworn declaration; false affidavit punishable under BNS, 2023',
    tags: ['affidavit', 'declaration', 'sworn', 'notary'],
    popular: true,
    structuredTypeKey: 'affidavit',
  },
  {
    key: 'affidavit-name-change',
    name: 'Name-change affidavit',
    category: 'Affidavits',
    description:
      'Affidavit declaring a change of name (for gazette / records / documents).',
    sampleBrief:
      'Affidavit of {{deponent_name}}, aged {{age}}, resident of {{address}}. I declare that my former name was {{old_name}} and that I have changed it to {{new_name}}; both names refer to one and the same person. I shall henceforth be known by my new name for all purposes. This affidavit is for the purpose of record/gazette notification.',
    applicableLaw: 'Sworn declaration for change of name',
    tags: ['name change', 'affidavit', 'gazette', 'former name'],
    structuredTypeKey: 'affidavit',
  },
  {
    key: 'affidavit-income',
    name: 'Income affidavit',
    category: 'Affidavits',
    description:
      'Affidavit declaring annual income (for scholarships, EWS, fee concession, court).',
    sampleBrief:
      'Affidavit of {{deponent_name}}, aged {{age}}, resident of {{address}}. I solemnly affirm that the total annual income of my family from all sources is ₹{{annual_income}} for the financial year {{financial_year}}, derived from {{income_sources}}. This affidavit is for the purpose of {{purpose}}.',
    applicableLaw: 'Sworn income declaration',
    tags: ['income', 'ews', 'scholarship', 'affidavit', 'fee concession'],
    structuredTypeKey: 'affidavit',
  },
  {
    key: 'affidavit-gap',
    name: 'Gap-year / education-gap affidavit',
    category: 'Affidavits',
    description:
      'Affidavit explaining a gap in education or employment (for admission / job).',
    sampleBrief:
      'Affidavit of {{deponent_name}}, aged {{age}}, resident of {{address}}. I declare that I had a gap from {{from_date}} to {{to_date}} on account of {{reason}}, during which I was not enrolled in any institution / not employed and was not involved in any unlawful activity. This affidavit is for {{purpose}}.',
    applicableLaw: 'Sworn declaration',
    tags: ['gap', 'education gap', 'admission', 'affidavit'],
    structuredTypeKey: 'affidavit',
  },
  {
    key: 'indemnity-bond',
    name: 'Indemnity bond',
    category: 'Affidavits',
    description:
      'Bond indemnifying a party against loss (lost document, duplicate issuance, claims).',
    sampleBrief:
      'Indemnity bond executed by {{executant_name}}, resident of {{address}}, in favour of {{beneficiary}}. Whereas {{circumstances}} (original document lost / duplicate sought / disbursement made), I undertake to indemnify and keep indemnified {{beneficiary}} against any loss, claim, demand or proceeding arising therefrom up to ₹{{amount}}.',
    applicableLaw: 'Indian Contract Act, 1872 §124 (contract of indemnity)',
    tags: ['indemnity', 'bond', 'lost document', 'duplicate', 'undertaking'],
  },

  // ── Agreements ─────────────────────────────────────────────────────────────
  {
    key: 'nda',
    name: 'Non-disclosure agreement (NDA)',
    category: 'Agreements',
    description: 'Mutual or one-way confidentiality agreement between two parties.',
    sampleBrief:
      'NDA between {{party_a}} ({{party_a_address}}) and {{party_b}} ({{party_b_address}}) for the purpose of {{purpose}}. Confidential information includes {{ci_scope}}. Mutual: {{mutual_yesno}}. Term of agreement: {{term}}; confidentiality survives for {{survival}} years. Exclusions: information already public / independently developed / rightfully received. Governing law: {{governing_state}}, India; disputes by arbitration at {{seat}}.',
    applicableLaw: 'Indian Contract Act, 1872',
    citationTopics: ['contract'],
    tags: ['nda', 'confidentiality', 'non-disclosure', 'secrecy'],
    popular: true,
    structuredTypeKey: 'nda',
  },
  {
    key: 'mou',
    name: 'Memorandum of understanding (MoU)',
    category: 'Agreements',
    description:
      'Non-binding (or partly binding) understanding between parties.',
    sampleBrief:
      'MoU between {{party_a}} and {{party_b}} regarding {{subject}}. Scope: {{scope}}. Roles & responsibilities: {{responsibilities}}. Duration: {{duration}}. Nature: this MoU records intent and, except for the confidentiality and exclusivity clauses, is not intended to be legally binding. Governing law: {{governing_state}}, India.',
    applicableLaw: 'Indian Contract Act, 1872',
    citationTopics: ['contract'],
    tags: ['mou', 'understanding', 'intent', 'collaboration'],
  },
  {
    key: 'service-agreement',
    name: 'Service / consultancy agreement',
    category: 'Agreements',
    description:
      'Agreement for provision of services by a vendor / consultant / freelancer.',
    sampleBrief:
      'Service agreement between {{client_name}} (Client) and {{provider_name}} (Service Provider) for {{services}}. Scope of work: {{scope}}. Fees: ₹{{fees}} payable {{payment_terms}}. Term: {{term}}; termination on {{notice}} days\' notice. IP in deliverables vests in the Client on full payment. Confidentiality and limitation of liability apply. Governing law: {{governing_state}}, India.',
    applicableLaw: 'Indian Contract Act, 1872',
    citationTopics: ['contract'],
    tags: ['service', 'consultancy', 'freelance', 'sow', 'vendor'],
  },
  {
    key: 'loan-agreement',
    name: 'Loan agreement',
    category: 'Agreements',
    description:
      'Agreement recording a loan between a lender and a borrower, with interest and repayment.',
    sampleBrief:
      'Loan agreement between lender {{lender_name}} and borrower {{borrower_name}}. Principal: ₹{{principal}} advanced on {{disbursal_date}}. Interest: {{interest_rate}}% per annum. Repayment: {{repayment_terms}} (EMI / lump sum on {{due_date}}). Security/guarantee: {{security}}. Default and remedies specified. Governing law: {{governing_state}}, India.',
    applicableLaw: 'Indian Contract Act, 1872',
    citationTopics: ['contract'],
    tags: ['loan', 'lender', 'borrower', 'interest', 'repayment'],
  },
  {
    key: 'promissory-note',
    name: 'Promissory note',
    category: 'Agreements',
    description:
      'Unconditional written promise to pay a sum of money (NI Act §4). Cannot be eSigned.',
    sampleBrief:
      'Promissory note. I, {{maker_name}}, resident of {{maker_address}}, promise to pay {{payee_name}} or order the sum of ₹{{amount}} ({{amount_words}}) together with interest at {{interest_rate}}% per annum, for value received, on demand / on {{due_date}}. Executed at {{place}} on {{date}}.',
    applicableLaw: 'Negotiable Instruments Act, 1881 §4',
    citationTopics: ['contract'],
    tags: ['promissory note', 'pronote', 'iou', 'demand', 'negotiable instrument'],
    structuredTypeKey: 'promissory_note',
  },
  {
    key: 'partnership-deed',
    name: 'Partnership deed',
    category: 'Agreements',
    description:
      'Deed constituting a partnership firm (Indian Partnership Act, 1932).',
    sampleBrief:
      'Partnership deed for firm "{{firm_name}}" carrying on business of {{business}} at {{firm_address}}. Partners: {{partners}}. Capital contributions: {{capital}}. Profit/loss sharing ratio: {{profit_ratio}}. Duration: {{duration}} (at will / fixed). Banking, accounts, admission, retirement and dissolution terms specified. Governing law: Indian Partnership Act, 1932.',
    applicableLaw: 'Indian Partnership Act, 1932',
    citationTopics: ['contract'],
    tags: ['partnership', 'firm', 'partners', 'profit sharing', 'deed'],
  },
  {
    key: 'leave-licence',
    name: 'Leave & licence agreement',
    category: 'Agreements',
    description:
      'Leave-and-licence for premises (the Maharashtra-style alternative to a lease).',
    sampleBrief:
      'Leave & licence agreement between licensor {{licensor_name}} and licensee {{licensee_name}} for the premises at {{premises_address}}. Period: {{period}} months from {{start_date}}. Licence fee: ₹{{fee}} per month; deposit ₹{{deposit}} (refundable). The agreement creates a licence, not a tenancy, and confers no interest in the premises. Registration as applicable in the State.',
    applicableLaw: 'Indian Easements Act, 1882 §52 + State registration rules',
    citationTopics: ['rent', 'registration'],
    tags: ['leave and licence', 'licence', 'premises', 'rent', 'maharashtra'],
    structuredTypeKey: 'rent_agreement',
  },
  {
    key: 'gift-deed',
    name: 'Gift deed',
    category: 'Agreements',
    description:
      'Voluntary transfer of property by gift. Immovable-property gifts require registration; not eligible for Aadhaar eSign.',
    sampleBrief:
      'Gift deed by donor {{donor_name}} to donee {{donee_name}} ({{relationship}}) of {{property_description}}. The gift is made voluntarily out of natural love and affection, without any monetary consideration. The donee accepts the gift. Possession is/will be delivered. Stamp duty and registration as per the State.',
    applicableLaw: 'Transfer of Property Act, 1882 §122 + Registration Act, 1908 §17',
    citationTopics: ['registration', 'property'],
    tags: ['gift', 'donor', 'donee', 'transfer', 'deed', 'registration'],
  },
  {
    key: 'sale-agreement',
    name: 'Agreement to sell (immovable property)',
    category: 'Agreements',
    description:
      'Agreement to sell immovable property ahead of a sale deed. Conveyance is not eligible for Aadhaar eSign.',
    sampleBrief:
      'Agreement to sell between seller {{seller_name}} and buyer {{buyer_name}} for the property at {{property_address}} (admeasuring {{area}}). Total consideration: ₹{{price}}; earnest money ₹{{advance}} paid; balance on or before {{completion_date}} against registration of the sale deed. Title, possession, encumbrance and default terms specified. Stamp duty/registration as per the State.',
    applicableLaw: 'Transfer of Property Act, 1882 §54 + Registration Act, 1908',
    citationTopics: ['registration', 'property'],
    tags: ['sale', 'agreement to sell', 'property', 'conveyance', 'earnest'],
  },

  // ── HR & Corporate ──────────────────────────────────────────────────────────
  {
    key: 'offer-letter',
    name: 'Employment offer letter',
    category: 'HR & Corporate',
    description: 'Offer of employment with role, compensation, and start date.',
    sampleBrief:
      'Employment offer from {{company_name}} to {{candidate_name}} for the role of {{job_title}} reporting to {{reporting_to}}. CTC: ₹{{ctc}} per annum (break-up: {{ctc_breakup}}). Start date: {{start_date}}. Probation: {{probation}} months. Location: {{location}}. Notice period: {{notice}}. Offer subject to background verification and acceptance by {{accept_by}}.',
    applicableLaw: 'Terms of employment / contract',
    tags: ['offer letter', 'employment', 'hiring', 'ctc', 'hr'],
    popular: true,
    structuredTypeKey: 'employment_offer',
  },
  {
    key: 'appointment-letter',
    name: 'Appointment letter',
    category: 'HR & Corporate',
    description:
      'Formal appointment letter setting out terms of employment after joining.',
    sampleBrief:
      'Appointment letter from {{company_name}} to {{employee_name}} for the post of {{designation}} effective {{join_date}}. Remuneration: ₹{{ctc}} per annum. Working hours, leave, confidentiality, IP assignment, code of conduct, probation ({{probation}} months) and termination ({{notice}} notice) terms specified. Governed by company policy and applicable law.',
    applicableLaw: 'Terms of employment / contract',
    tags: ['appointment', 'employment', 'joining', 'hr'],
  },
  {
    key: 'experience-certificate',
    name: 'Experience / relieving letter',
    category: 'HR & Corporate',
    description:
      'Experience-cum-relieving certificate issued on an employee\'s exit.',
    sampleBrief:
      'This is to certify that {{employee_name}} was employed with {{company_name}} as {{designation}} from {{from_date}} to {{to_date}}. During the tenure their conduct and performance were {{conduct}}. They are relieved of duties with effect from {{relieving_date}} and no dues are pending. We wish them success.',
    applicableLaw: 'HR document (no statute)',
    tags: ['experience', 'relieving', 'certificate', 'exit', 'hr'],
  },
  {
    key: 'board-resolution',
    name: 'Board resolution',
    category: 'HR & Corporate',
    description:
      'Resolution passed by the board of directors of a company.',
    sampleBrief:
      'Certified true copy of a resolution passed at the meeting of the Board of Directors of {{company_name}} (CIN {{cin}}) held on {{meeting_date}} at {{place}}. "RESOLVED THAT {{resolution_text}} ... and that {{authorised_person}} be and is hereby authorised to do all acts necessary to give effect to this resolution." Certified by {{signatory}}, Director/Company Secretary.',
    applicableLaw: 'Companies Act, 2013',
    tags: ['board resolution', 'company', 'directors', 'authorisation', 'corporate'],
  },

  // ── Personal ────────────────────────────────────────────────────────────────
  {
    key: 'will',
    name: 'Will / testament',
    category: 'Personal',
    description:
      'Last will and testament. Not eligible for Aadhaar eSign; requires two witnesses.',
    sampleBrief:
      'Will of {{testator_name}}, aged {{age}}, resident of {{address}}, made of sound mind and free will. I appoint {{executor_name}} as executor. My assets and bequests: {{bequests}}. Residue to {{residuary_beneficiary}}. This is my last will and revokes all earlier wills and codicils. Signed in the presence of two witnesses.',
    applicableLaw: 'Indian Succession Act, 1925',
    tags: ['will', 'testament', 'executor', 'bequest', 'inheritance', 'witnesses'],
    structuredTypeKey: 'will',
  },
  {
    key: 'gpa',
    name: 'Power of attorney',
    category: 'Personal',
    description:
      'General/special power of attorney. Not eligible for Aadhaar eSign; often requires notarisation/registration.',
    sampleBrief:
      'Power of attorney by {{principal_name}}, resident of {{principal_address}}, appointing {{attorney_name}} ({{relationship}}), resident of {{attorney_address}}, as lawful attorney to act for {{purpose}}. Powers granted: {{powers}}. Type: {{type}} (general / special). The principal ratifies all lawful acts done under this authority. To be notarised/registered as applicable.',
    applicableLaw: 'Powers-of-Attorney Act, 1882 (+ Registration Act where required)',
    tags: ['power of attorney', 'poa', 'gpa', 'attorney', 'principal'],
    structuredTypeKey: 'power_of_attorney',
  },
  {
    key: 'noc',
    name: 'No-objection certificate (NOC)',
    category: 'Personal',
    description:
      'No-objection certificate (landlord / employer / parent / society / co-owner).',
    sampleBrief:
      'No-objection certificate issued by {{issuer_name}} ({{issuer_capacity}}) in favour of {{beneficiary_name}}. I/We have no objection to {{purpose}} (the beneficiary taking up employment / using the address / travelling / registering the vehicle / sub-letting). This NOC is issued on {{date}} for the stated purpose only.',
    applicableLaw: 'Declaration (no statute)',
    tags: ['noc', 'no objection', 'consent', 'landlord', 'employer'],
  },

  // ── Information ───────────────────────────────────────────────────────────
  {
    key: 'rti-application',
    name: 'RTI application',
    category: 'Information',
    description:
      'Application under the Right to Information Act, 2005 to a Public Information Officer.',
    sampleBrief:
      'RTI application to the Public Information Officer, {{department}}. Applicant: {{applicant_name}}, {{applicant_address}}. Information sought: {{questions}}. Period concerned: {{period}}. Application fee of ₹10 is enclosed; if this office is not the correct PIO, kindly transfer under §6(3). I am an Indian citizen.',
    applicableLaw: 'Right to Information Act, 2005',
    citationTopics: ['rti'],
    tags: ['rti', 'information', 'pio', 'transparency'],
    popular: true,
    structuredTypeKey: 'rti',
  },
  {
    key: 'rti-first-appeal',
    name: 'RTI first appeal',
    category: 'Information',
    description:
      'First appeal under §19(1) RTI Act against no/incomplete reply from the PIO.',
    sampleBrief:
      'First appeal under §19(1) of the RTI Act, 2005 to the First Appellate Authority, {{department}}, against the PIO. Original RTI dated {{rti_date}} (ref {{ref_no}}). Grounds: no reply within 30 days / incomplete / misleading / wrongful denial under {{denied_clause}}. The appellant prays that the information sought be directed to be furnished.',
    applicableLaw: 'Right to Information Act, 2005 §19(1)',
    citationTopics: ['rti'],
    tags: ['rti', 'first appeal', 'appellate authority', '19'],
  },

  // ── Business (global-friendly) ──────────────────────────────────────────────
  {
    key: 'invoice',
    name: 'Invoice',
    category: 'Business',
    description: 'A commercial invoice for goods or services rendered.',
    sampleBrief:
      'Invoice from {{seller_name}}, {{seller_address}} (GSTIN/Tax ID {{tax_id}}) to {{buyer_name}}, {{buyer_address}}. Invoice no. {{invoice_no}} dated {{invoice_date}}. Line items: {{line_items}}. Subtotal {{subtotal}}, tax {{tax}}, total {{total}}. Payment terms: {{terms}} (due {{due_date}}). Bank/UPI details: {{payment_details}}.',
    applicableLaw: 'Commercial invoice (GST where applicable in India)',
    tags: ['invoice', 'bill', 'gst', 'tax invoice', 'billing'],
    popular: true,
    structuredTypeKey: 'invoice',
  },
  {
    key: 'payment-receipt',
    name: 'Payment receipt',
    category: 'Business',
    description: 'Acknowledges money received (any payment).',
    sampleBrief:
      'Payment receipt no. {{receipt_no}} dated {{date}}. Received with thanks from {{payer_name}} the sum of ₹{{amount}} ({{amount_words}}) by {{mode}} (ref {{reference}}) towards {{purpose}}. Issued by {{issuer_name}}.',
    applicableLaw: 'Receipt (acknowledgement of payment)',
    tags: ['receipt', 'payment received', 'acknowledgement', 'paid'],
    popular: true,
    structuredTypeKey: 'receipt',
  },
  {
    key: 'quotation',
    name: 'Quotation / estimate',
    category: 'Business',
    description: 'A price quotation or estimate for goods or services.',
    sampleBrief:
      'Quotation from {{company_name}} to {{client_name}} for {{scope}}. Line items with quantities and unit prices: {{items}}. Total {{total}}, valid until {{valid_until}}. Terms: {{terms}}.',
    applicableLaw: 'Commercial document',
    tags: ['quotation', 'estimate', 'quote', 'proposal'],
    structuredTypeKey: 'quotation',
  },
  {
    key: 'purchase-order',
    name: 'Purchase order (PO)',
    category: 'Business',
    description: 'A buyer-issued order to a vendor for goods or services.',
    sampleBrief:
      'Purchase order no. {{po_no}} dated {{date}} from {{buyer_name}}, {{buyer_address}} to {{vendor_name}}, {{vendor_address}}. Items ordered with quantities and unit prices: {{items}}. Total {{total}}. Delivery required by {{required_by}} at {{ship_to}}. Terms: {{terms}}. Please quote this PO number on all invoices.',
    applicableLaw: 'Commercial document',
    tags: ['purchase order', 'po', 'procurement', 'order', 'vendor'],
    structuredTypeKey: 'purchase_order',
  },
  {
    key: 'credit-note',
    name: 'Credit / debit note',
    category: 'Business',
    description: 'Adjusts an earlier invoice (return, discount, under-charge).',
    sampleBrief:
      '{{note_type}} note no. {{note_no}} dated {{date}} issued by {{seller_name}} to {{buyer_name}} against invoice {{invoice_no}} dated {{invoice_date}}. Reason: {{reason}}. Adjusted line items: {{items}}. Total {{total}}. The amount has been credited/debited to the buyer’s account.',
    applicableLaw: 'GST credit/debit note (where applicable in India)',
    tags: ['credit note', 'debit note', 'gst', 'return', 'adjustment'],
    structuredTypeKey: 'credit_note',
  },
  {
    key: 'payslip',
    name: 'Payslip / salary slip',
    category: 'Business',
    description: 'A monthly pay statement with earnings, deductions, and net pay.',
    sampleBrief:
      'Payslip for {{employee_name}} ({{designation}}, {{employee_id}}) at {{employer_name}} for {{pay_period}}. Earnings: {{earnings}}. Deductions: {{deductions}}. Net pay {{net_pay}} ({{net_pay_words}}). Paid on {{pay_date}} to account {{bank_account}}.',
    applicableLaw: 'Pay statement (Payment of Wages Act / company policy)',
    tags: ['payslip', 'salary slip', 'pay statement', 'wages', 'salary'],
    structuredTypeKey: 'payslip',
  },
  {
    key: 'statement-of-work',
    name: 'Statement of Work (SOW)',
    category: 'Business',
    description: 'An SOW under a master services agreement.',
    sampleBrief:
      'Statement of Work #{{sow_number}} under the MSA dated {{msa_date}} between {{client_name}} and {{provider_name}}. Project: {{project}}. Scope: {{scope}}. Deliverables: {{deliverables}}. Timeline/milestones: {{milestones}}. Fees: {{fees}}; payment schedule: {{payment_schedule}}. Acceptance criteria: {{acceptance}}.',
    applicableLaw: 'Contract (governed by the parent MSA)',
    tags: ['sow', 'statement of work', 'scope', 'deliverables', 'msa'],
  },
  {
    key: 'privacy-policy',
    name: 'Privacy policy',
    category: 'Business',
    description: 'A website/app privacy policy (DPDP Act / GDPR-aware).',
    sampleBrief:
      'Privacy policy for {{company_name}} ({{website}}). Data collected: {{data_types}}. Purposes: {{purposes}}. Legal basis/consent: {{basis}}. Sharing with third parties: {{sharing}}. Retention: {{retention}}. User rights (access, correction, erasure): {{rights}}. Grievance officer: {{grievance_contact}}.',
    applicableLaw: 'Digital Personal Data Protection Act, 2023 (India) / GDPR where applicable',
    tags: ['privacy policy', 'dpdp', 'gdpr', 'data protection', 'website'],
  },
  {
    key: 'terms-of-service',
    name: 'Terms of service',
    category: 'Business',
    description: 'Website/app terms of service / terms of use.',
    sampleBrief:
      'Terms of Service for {{company_name}} ({{website}}). Service description: {{service}}. Eligibility, acceptable use, accounts, payment ({{pricing}}), intellectual property, disclaimers, limitation of liability, termination, governing law: {{governing_law}}.',
    applicableLaw: 'Contract / IT Act, 2000 (India) where applicable',
    tags: ['terms of service', 'tos', 'terms of use', 'eula', 'website'],
  },
  {
    key: 'refund-policy',
    name: 'Refund / cancellation policy',
    category: 'Business',
    description: 'A refund, return, and cancellation policy.',
    sampleBrief:
      'Refund and cancellation policy for {{company_name}}. Eligibility window: {{window}}. Conditions: {{conditions}}. Non-refundable items: {{exclusions}}. Process and timeline: {{process}}. Contact: {{contact}}.',
    applicableLaw: 'Consumer Protection Act, 2019 (India) where applicable',
    tags: ['refund', 'cancellation', 'return policy', 'ecommerce'],
  },
  {
    key: 'data-processing-agreement',
    name: 'Data processing agreement (DPA)',
    category: 'Business',
    description: 'A DPA between a data controller/fiduciary and a processor.',
    sampleBrief:
      'Data Processing Agreement between {{controller}} (Controller/Fiduciary) and {{processor}} (Processor). Subject matter: {{subject}}. Categories of data and data subjects: {{data}}. Processing instructions, security measures, sub-processors, breach notification, audit rights, return/deletion on termination. Governing law: {{governing_law}}.',
    applicableLaw: 'DPDP Act, 2023 (India) / GDPR Art. 28 where applicable',
    tags: ['dpa', 'data processing', 'gdpr', 'dpdp', 'processor'],
  },
  {
    key: 'term-sheet',
    name: 'Investment term sheet',
    category: 'Business',
    description: 'A non-binding term sheet for an equity investment.',
    sampleBrief:
      'Term sheet for an investment in {{company_name}} by {{investor_name}}. Investment amount {{amount}} for {{equity}}% (pre-money valuation {{valuation}}). Instrument: {{instrument}}. Key terms: liquidation preference, anti-dilution, board, vesting, information rights. Non-binding except confidentiality and exclusivity.',
    applicableLaw: 'Contract / Companies Act, 2013 (India) where applicable',
    tags: ['term sheet', 'investment', 'startup', 'equity', 'vc'],
  },
  {
    key: 'board-meeting-minutes',
    name: 'Meeting minutes',
    category: 'Business',
    description: 'Minutes of a board or committee meeting.',
    sampleBrief:
      'Minutes of the {{meeting_type}} meeting of {{company_name}} held on {{date}} at {{place}}. Present: {{attendees}}. Agenda items and decisions: {{agenda_decisions}}. Resolutions passed: {{resolutions}}. Meeting concluded at {{end_time}}.',
    applicableLaw: 'Companies Act, 2013 / SS-1 & SS-2 (India) where applicable',
    tags: ['minutes', 'mom', 'board meeting', 'resolution', 'corporate'],
  },

  // ── More Agreements (India + global) ────────────────────────────────────────
  {
    key: 'consulting-agreement',
    name: 'Consulting agreement',
    category: 'Agreements',
    description: 'Independent consultant / professional services engagement.',
    sampleBrief:
      'Consulting agreement between {{client_name}} and {{consultant_name}} (independent contractor). Services: {{services}}. Term: {{term}}. Fees: {{fees}}, paid {{payment_terms}}. IP ownership, confidentiality, independent-contractor status (no employment), and termination on {{notice}} notice. Governing law: {{governing_state}}.',
    applicableLaw: 'Indian Contract Act, 1872 / contract',
    citationTopics: ['contract'],
    tags: ['consulting', 'independent contractor', 'consultant', 'freelance'],
  },
  {
    key: 'master-services-agreement',
    name: 'Master services agreement (MSA)',
    category: 'Agreements',
    description: 'Umbrella MSA under which SOWs are executed.',
    sampleBrief:
      'Master Services Agreement between {{client_name}} and {{provider_name}}. Framework terms: ordering via SOWs, fees and invoicing, IP, confidentiality, warranties, indemnity, limitation of liability, term and termination, governing law {{governing_law}}. Individual engagements are documented in SOWs.',
    applicableLaw: 'Indian Contract Act, 1872 / contract',
    citationTopics: ['contract'],
    tags: ['msa', 'master services', 'framework agreement', 'vendor'],
  },
  {
    key: 'saas-agreement',
    name: 'SaaS subscription agreement',
    category: 'Agreements',
    description: 'Software-as-a-service subscription terms.',
    sampleBrief:
      'SaaS agreement between {{provider_name}} and {{customer_name}}. Subscription to {{product}}. Plan/fees: {{plan}}. Term and renewal, SLA/uptime {{sla}}, data ownership and security, support, IP, limitation of liability, termination, governing law {{governing_law}}.',
    applicableLaw: 'Indian Contract Act, 1872 / contract',
    citationTopics: ['contract'],
    tags: ['saas', 'subscription', 'software', 'license', 'sla'],
  },
  {
    key: 'employment-agreement',
    name: 'Employment agreement',
    category: 'Agreements',
    description: 'A full employment contract (beyond the offer letter).',
    sampleBrief:
      'Employment agreement between {{company_name}} and {{employee_name}} for the role of {{job_title}}. Duties, compensation {{ctc}}, working hours, leave, confidentiality, IP assignment, code of conduct, notice period {{notice}}, and termination. Governed by Indian law.',
    applicableLaw: 'Indian Contract Act, 1872 + labour laws',
    citationTopics: ['contract'],
    tags: ['employment agreement', 'employment contract', 'cdc'],
  },
  {
    key: 'non-compete',
    name: 'Non-compete / non-solicit',
    category: 'Agreements',
    description:
      'A restrictive-covenant agreement. Note: post-employment non-competes are generally unenforceable in India (Contract Act §27).',
    sampleBrief:
      'Restrictive covenant agreement between {{company_name}} and {{individual_name}}. Non-solicitation of clients/employees for {{period}}, confidentiality, and (during engagement only) non-compete. Note: in India, restraints operating after the term are void under §27 of the Contract Act.',
    applicableLaw: 'Indian Contract Act, 1872 §27 (restraint of trade)',
    citationTopics: ['contract'],
    tags: ['non-compete', 'non-solicit', 'restrictive covenant', 'section 27'],
  },
  {
    key: 'shareholders-agreement',
    name: 'Shareholders / founders agreement',
    category: 'Agreements',
    description: 'Agreement among shareholders/founders of a company.',
    sampleBrief:
      'Shareholders agreement among {{shareholders}} of {{company_name}}. Shareholding {{cap_table}}, board composition, reserved matters, transfer restrictions (ROFR/tag/drag), vesting, deadlock, exit, and governing law {{governing_law}}.',
    applicableLaw: 'Companies Act, 2013 + Indian Contract Act, 1872',
    citationTopics: ['contract'],
    tags: ['shareholders agreement', 'sha', 'founders', 'cap table', 'vesting'],
  },
  {
    key: 'sale-of-goods-agreement',
    name: 'Sale of goods / purchase agreement',
    category: 'Agreements',
    description: 'Agreement for the sale and purchase of goods.',
    sampleBrief:
      'Agreement for sale of goods between seller {{seller_name}} and buyer {{buyer_name}}. Goods: {{goods}}. Quantity/specs: {{specs}}. Price {{price}}, payment {{payment_terms}}. Delivery: {{delivery_terms}}. Warranties, risk/title transfer, and governing law {{governing_law}}.',
    applicableLaw: 'Sale of Goods Act, 1930 (India)',
    citationTopics: ['contract'],
    tags: ['sale of goods', 'purchase agreement', 'supply', 'goods'],
  },

  // ── More HR & Corporate ─────────────────────────────────────────────────────
  {
    key: 'internship-offer',
    name: 'Internship offer letter',
    category: 'HR & Corporate',
    description: 'Offer of an internship with stipend and duration.',
    sampleBrief:
      'Internship offer from {{company_name}} to {{intern_name}} for an internship as {{role}} from {{start_date}} to {{end_date}}. Stipend: {{stipend}}. Working hours, mentor {{mentor}}, confidentiality, and certificate on satisfactory completion.',
    applicableLaw: 'Contract',
    tags: ['internship', 'intern', 'stipend', 'offer'],
  },
  {
    key: 'termination-letter',
    name: 'Termination letter',
    category: 'HR & Corporate',
    description: 'Letter terminating employment.',
    sampleBrief:
      'Termination letter from {{company_name}} to {{employee_name}} ({{designation}}). Reason: {{reason}}. Last working day: {{last_day}}. Notice/pay-in-lieu, full-and-final settlement, return of company property, and continuing confidentiality obligations.',
    applicableLaw: 'Terms of employment + applicable labour law',
    tags: ['termination', 'dismissal', 'separation', 'hr'],
  },
  {
    key: 'resignation-letter',
    name: 'Resignation letter',
    category: 'HR & Corporate',
    description: 'An employee resignation letter.',
    sampleBrief:
      'Resignation letter from {{employee_name}} to {{manager_name}}, {{company_name}}. Resigning from the position of {{designation}}, last working day {{last_day}} (serving {{notice}} notice). Gratitude and offer to assist in transition.',
    applicableLaw: 'Terms of employment',
    tags: ['resignation', 'resign', 'notice', 'quit'],
  },
  {
    key: 'recommendation-letter',
    name: 'Recommendation / reference letter',
    category: 'HR & Corporate',
    description: 'A professional or academic recommendation letter.',
    sampleBrief:
      'Recommendation letter for {{candidate_name}} by {{recommender_name}}, {{recommender_title}} at {{organisation}}. Relationship and duration: {{relationship}}. Strengths and specific examples: {{highlights}}. Strong recommendation for {{purpose}}.',
    applicableLaw: 'Reference document (no statute)',
    tags: ['recommendation', 'reference', 'lor', 'endorsement'],
  },
  {
    key: 'warning-letter',
    name: 'Warning / disciplinary letter',
    category: 'HR & Corporate',
    description: 'A disciplinary warning letter to an employee.',
    sampleBrief:
      'Warning letter from {{company_name}} to {{employee_name}} ({{designation}}). Issue: {{issue}} on {{incident_date}}. Expected corrective action: {{action}}. This is a {{level}} warning; further violations may lead to disciplinary action up to termination.',
    applicableLaw: 'Terms of employment / company policy',
    tags: ['warning', 'disciplinary', 'memo', 'hr'],
  },

  // ── More Personal ─────────────────────────────────────────────────────────
  {
    key: 'authorization-letter',
    name: 'Authorization letter',
    category: 'Personal',
    description: 'Authorising someone to act/collect on your behalf.',
    sampleBrief:
      'Authorization letter from {{principal_name}} authorising {{authorised_name}} ({{relationship}}, ID {{id_number}}) to {{purpose}} (collect documents / operate account / represent) on my behalf on {{date}}. This authorisation is limited to the stated purpose.',
    applicableLaw: 'Authorisation (simple, non-PoA)',
    tags: ['authorization', 'authorisation', 'letter', 'collect', 'represent'],
  },
  {
    key: 'rent-receipt',
    name: 'Rent receipt',
    category: 'Personal',
    description: 'A receipt for rent paid (for HRA / records).',
    sampleBrief:
      'Rent receipt: received from {{tenant_name}} the sum of ₹{{amount}} towards rent of {{premises_address}} for the period {{period}}, paid by {{mode}}. Landlord: {{landlord_name}} (PAN {{landlord_pan}}). Date: {{date}}.',
    applicableLaw: 'Receipt (HRA — Income-tax rules)',
    tags: ['rent receipt', 'hra', 'receipt', 'landlord'],
  },
  {
    key: 'relinquishment-deed',
    name: 'Relinquishment deed',
    category: 'Personal',
    description:
      'A co-heir releasing their share in inherited property. Immovable-property release requires registration; not eSignable.',
    sampleBrief:
      'Relinquishment deed by {{releasor_name}} in favour of {{releasee_name}} ({{relationship}}), relinquishing all right, title and interest in {{property_description}} inherited from {{deceased_name}}. Voluntary, without consideration. Stamp duty and registration as per the State.',
    applicableLaw: 'Transfer of Property Act, 1882 + Registration Act, 1908',
    citationTopics: ['registration', 'property'],
    tags: ['relinquishment', 'release deed', 'inheritance', 'co-heir'],
  },
];

const BY_KEY = new Map(DOCUMENT_PRESETS.map((p) => [p.key, p]));

export function getDocumentPreset(key: string): DocumentPreset | undefined {
  return BY_KEY.get(key);
}

/** All presets in a category, popular ones first. */
export function presetsByCategory(
  category: DocumentPresetCategory,
): DocumentPreset[] {
  return DOCUMENT_PRESETS.filter((p) => p.category === category).sort(
    (a, b) => Number(b.popular ?? false) - Number(a.popular ?? false),
  );
}
