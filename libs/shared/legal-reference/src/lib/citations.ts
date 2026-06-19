/**
 * Curated Indian legal-citation reference — the source of truth for statutory
 * references in generated documents. The AI must NOT author statute section
 * numbers (a model trained before mid-2024 will emit repealed IPC/CrPC/Evidence
 * sections as if current). Instead, generation leaves `{{applicable_law}}`
 * placeholders and this library is used to fill them.
 *
 * ⚠️ ACCURACY POLICY
 *  - The **act-level reforms** (`CRIMINAL_CODE_REFORMS`) are authoritative.
 *  - **Section-level mappings/numbers are a curated starting point** and carry a
 *    `confidence` flag. Always verify a section number against the official bare
 *    act (and a qualified advocate) before relying on it in a binding document.
 *  - Add entries here deliberately — this is product/legal IP, not a dumping ground.
 */

export type CitationConfidence = 'high' | 'moderate' | 'low';

/** The three 2024 criminal-law codifications that replaced the colonial-era codes. */
export interface CodeReform {
  repealed: string;
  replacedBy: string;
  short: string;
  effectiveFrom: string; // ISO yyyy-mm-dd
}

export const CRIMINAL_CODE_REFORMS: CodeReform[] = [
  {
    repealed: 'Indian Penal Code, 1860 (IPC)',
    replacedBy: 'Bharatiya Nyaya Sanhita, 2023 (BNS)',
    short: 'IPC → BNS',
    effectiveFrom: '2024-07-01',
  },
  {
    repealed: 'Code of Criminal Procedure, 1973 (CrPC)',
    replacedBy: 'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
    short: 'CrPC → BNSS',
    effectiveFrom: '2024-07-01',
  },
  {
    repealed: 'Indian Evidence Act, 1872',
    replacedBy: 'Bharatiya Sakshya Adhiniyam, 2023 (BSA)',
    short: 'Evidence Act → BSA',
    effectiveFrom: '2024-07-01',
  },
];

/**
 * A guardrail line for AI prompts. Reinforces "do not cite repealed codes as
 * current law" with the specific reform facts.
 */
export const CRIMINAL_CODE_REFORM_NOTE =
  'Indian criminal law was overhauled with effect from 2024-07-01: the Indian Penal Code 1860 was replaced by the Bharatiya Nyaya Sanhita (BNS) 2023, the Code of Criminal Procedure 1973 by the Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023, and the Indian Evidence Act 1872 by the Bharatiya Sakshya Adhiniyam (BSA) 2023. Do NOT cite repealed IPC / CrPC / Evidence Act sections as current law. If a statutory reference is unavoidable, insert a {{applicable_law}} placeholder for a qualified advocate to fill rather than guessing a section number.';

export interface Citation {
  /** Stable slug, e.g. "bnss.223". */
  id: string;
  act: string;
  actShort?: string;
  /** Section / article, e.g. "223". Optional for act-level references. */
  section?: string;
  title: string;
  summary: string;
  /** When this provision came into force (ISO yyyy-mm-dd), if relevant. */
  effectiveFrom?: string;
  /** Citation id of the provision this superseded, e.g. "crpc.200". */
  supersedes?: string;
  confidence: CitationConfidence;
  /** Verification reminder shown to humans/agents before binding use. */
  verifyNote?: string;
  topics?: string[];
  /** Document type keys this citation applies to (e.g. ['legal_notice',
   *  'cheque_bounce']). Drives the filler's "what to insert" and the
   *  analyzer's "what's missing" pass. */
  appliesTo?: string[];
  /** Other citation ids commonly cited together with this one (e.g.
   *  ni.138 → ['ni.141','ni.142']). Drives "Consider also citing X". */
  commonlyPairedWith?: string[];
  /** ISO yyyy-mm-dd: 'IN' default; future-proof. */
  jurisdiction?: string;
  /** Long-form drafting guidance for the public /law/:id page (later). */
  draftingTips?: string;
  /** Canonical-text source link (indiacode.nic.in for IN). */
  externalUrl?: string;
}

const VERIFY =
  'Verify the section number against the official bare act before binding use.';

export const CITATIONS: Citation[] = [
  // ── Stable references (acts not affected by the 2024 reform) ──────────────
  {
    id: 'ni.138',
    act: 'Negotiable Instruments Act, 1881',
    actShort: 'NI Act',
    section: '138',
    title: 'Dishonour of cheque for insufficiency of funds',
    summary:
      'Criminalises cheque bounce. Payee must send a written demand notice within 30 days of the bank return; drawer gets 15 days to pay; complaint may be filed within one month of the 15-day window lapsing.',
    confidence: 'high',
    topics: ['cheque-bounce', 'notice', 'criminal'],
    appliesTo: ['legal_notice', 'cheque_bounce_notice'],
    commonlyPairedWith: ['ni.141', 'ni.142'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
  },
  {
    id: 'ni.141',
    act: 'Negotiable Instruments Act, 1881',
    actShort: 'NI Act',
    section: '141',
    title: 'Offences by companies (officer-in-default liability)',
    summary:
      'When a company commits an offence under §138, every person who at the time was in charge of and responsible for the conduct of the business is also deemed guilty, alongside the company. Cite when the drawer is a company / LLP.',
    confidence: 'high',
    topics: ['cheque-bounce', 'company', 'criminal'],
    appliesTo: ['legal_notice', 'cheque_bounce_notice'],
    commonlyPairedWith: ['ni.138'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
  },
  {
    id: 'ni.142',
    act: 'Negotiable Instruments Act, 1881',
    actShort: 'NI Act',
    section: '142',
    title: 'Cognizance of offences (limitation + jurisdiction)',
    summary:
      'Court takes cognizance only on a written complaint by the payee, filed within one month of the cause of action (i.e. lapse of the 15-day payment window under §138). Jurisdiction lies where the cheque was drawn / presented / dishonoured.',
    confidence: 'high',
    topics: ['cheque-bounce', 'limitation', 'criminal'],
    appliesTo: ['legal_notice', 'cheque_bounce_notice'],
    commonlyPairedWith: ['ni.138'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/2189',
  },
  {
    id: 'cpa.2019',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    title: 'Consumer Protection Act, 2019',
    summary:
      'Governs consumer complaints. Pecuniary jurisdiction (per the 2021 Jurisdiction Rules, keyed on the value of consideration PAID — not the relief claimed): District Commission up to ₹50 lakh, State Commission ₹50 lakh–₹2 crore, National Commission above ₹2 crore.',
    confidence: 'high',
    verifyNote:
      'Pecuniary limits were revised by notification dated 30 Dec 2021 (effective on notification); confirm the current thresholds before filing.',
    topics: ['consumer'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: [
      'cpa.2.7',
      'cpa.34',
      'cpa.47',
      'cpa.58',
      'cpa.69',
      'cpa.39',
    ],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.2.7',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '2(7)',
    title: 'Definition of "consumer"',
    summary:
      'A "consumer" buys goods or avails services for consideration and NOT for resale or any commercial purpose; the bar is lifted where the goods/services are used exclusively to earn a livelihood by self-employment. Online/e-commerce transactions are covered.',
    confidence: 'high',
    topics: ['consumer'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.2019'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.34',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '34',
    title: 'Jurisdiction of the District Commission',
    summary:
      'The District Commission hears complaints where the consideration paid does not exceed ₹50 lakh (per the 2021 Rules). §34(2): a complaint may be filed where an opposite party resides / carries on business / has a branch / works for gain, OR where the cause of action arose, OR where the complainant resides or personally works for gain.',
    confidence: 'high',
    topics: ['consumer', 'jurisdiction'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.2019', 'cpa.35'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.35',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '35',
    title: 'Manner in which a complaint shall be made (District Commission)',
    summary:
      'How a complaint is instituted before the District Commission — by the consumer, a recognised consumer association, the Central/State Government, or one or more consumers with the same interest. Filing section for District-Commission complaints.',
    confidence: 'high',
    topics: ['consumer', 'procedure'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.34'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.47',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '47',
    title: 'Jurisdiction of the State Commission',
    summary:
      'The State Commission hears, as an original complaint, matters where the consideration paid exceeds ₹50 lakh but does not exceed ₹2 crore (per the 2021 Rules), and appeals from District Commissions.',
    confidence: 'high',
    topics: ['consumer', 'jurisdiction'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.2019'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.58',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '58',
    title: 'Jurisdiction of the National Commission',
    summary:
      'The National Commission hears, as an original complaint, matters where the consideration paid exceeds ₹2 crore (per the 2021 Rules), and appeals from State Commissions.',
    confidence: 'high',
    topics: ['consumer', 'jurisdiction'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.2019'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.69',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '69',
    title: 'Limitation period',
    summary:
      'A complaint must be filed within two years of the date on which the cause of action arose. A Commission may admit a later complaint if the complainant shows sufficient cause for the delay (which must be recorded in writing).',
    confidence: 'high',
    topics: ['consumer', 'limitation'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.2019'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'cpa.39',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    section: '39',
    title: 'Findings and reliefs of the District Commission',
    summary:
      'Reliefs a Commission may order: remove the defect, replace the goods, refund the price, pay compensation for loss/injury (including for negligence), discontinue an unfair/restrictive trade practice, withdraw hazardous goods, pay punitive damages, and costs.',
    confidence: 'high',
    topics: ['consumer', 'relief'],
    appliesTo: ['consumer_complaint'],
    commonlyPairedWith: ['cpa.2019'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/15256',
  },
  {
    id: 'registration.17',
    act: 'Registration Act, 1908',
    actShort: 'Registration Act',
    section: '17',
    title: 'Documents of which registration is compulsory',
    summary:
      'Leases of immovable property from year to year, or for any term exceeding one year, or reserving a yearly rent, require registration. State stamp-duty/registration thresholds vary.',
    confidence: 'high',
    topics: ['rent', 'registration', 'property'],
    appliesTo: ['rent_agreement'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/2444',
  },
  {
    id: 'it.3a',
    act: 'Information Technology Act, 2000',
    actShort: 'IT Act',
    section: '3A',
    title: 'Electronic signature',
    summary:
      'Recognises electronic signatures (incl. Aadhaar eSign via empaneled ESPs) as legally valid, read with Schedule 2. Schedule 1 excludes some instruments (wills, powers of attorney, trusts, certain conveyances).',
    confidence: 'high',
    topics: ['esign'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/1999',
  },
  {
    id: 'rti.2005',
    act: 'Right to Information Act, 2005',
    actShort: 'RTI Act',
    title: 'Right to Information Act, 2005',
    summary:
      'Right to request information from public authorities; application to the PIO, generally answered within 30 days. Central portal: rtionline.gov.in.',
    confidence: 'high',
    topics: ['rti'],
    appliesTo: ['rti'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/1362',
  },

  {
    id: 'toa.105',
    act: 'Transfer of Property Act, 1882',
    actShort: 'TPA',
    section: '105',
    title: 'Lease of immovable property defined',
    summary:
      'Defines a lease as a transfer of the right to enjoy immovable property for a term (or in perpetuity) in consideration of rent/premium, distinguishing it from a licence. The foundational provision for any tenancy.',
    confidence: 'high',
    topics: ['rent', 'property', 'lease'],
    appliesTo: ['rent_agreement'],
    commonlyPairedWith: ['toa.106', 'registration.17'],
  },
  {
    id: 'toa.106',
    act: 'Transfer of Property Act, 1882',
    actShort: 'TPA',
    section: '106',
    title: 'Duration and termination of lease absent a written contract',
    summary:
      'In the absence of a contract/local usage to the contrary, a lease for agricultural/manufacturing purposes is year-to-year (six months’ notice), and any other lease is month-to-month (15 days’ notice expiring with the tenancy month). Governs notices to quit. State rent-control statutes may override.',
    confidence: 'high',
    verifyNote:
      'State rent-control / tenancy legislation often overrides §106 — check the applicable state Act before relying on these notice periods.',
    topics: ['rent', 'property', 'lease', 'notice'],
    appliesTo: ['rent_agreement', 'legal_notice'],
    commonlyPairedWith: ['toa.105'],
  },
  {
    id: 'contract.73',
    act: 'Indian Contract Act, 1872',
    actShort: 'Contract Act',
    section: '73',
    title: 'Compensation for loss or damage caused by breach of contract',
    summary:
      'The party suffering breach may recover compensation for loss/damage that naturally arose in the usual course of things, or which the parties knew was likely. Remote and indirect loss is not recoverable; the claimant must mitigate.',
    confidence: 'high',
    topics: ['contract', 'breach', 'damages'],
    appliesTo: ['nda', 'promissory_note', 'employment_offer'],
    commonlyPairedWith: ['contract.74'],
  },
  {
    id: 'contract.74',
    act: 'Indian Contract Act, 1872',
    actShort: 'Contract Act',
    section: '74',
    title: 'Liquidated damages and stipulated penalty',
    summary:
      'Where a sum is named in the contract as payable on breach (or it contains a penalty stipulation), the aggrieved party is entitled to reasonable compensation not exceeding that sum — proof of actual loss is not always required, but the award is capped at a genuine pre-estimate, not a penalty.',
    confidence: 'high',
    topics: ['contract', 'breach', 'damages', 'penalty'],
    appliesTo: ['nda', 'promissory_note'],
    commonlyPairedWith: ['contract.73'],
  },
  {
    id: 'arb.7',
    act: 'Arbitration and Conciliation Act, 1996',
    actShort: 'A&C Act',
    section: '7',
    title: 'Arbitration agreement',
    summary:
      'An arbitration agreement must be in writing (signed document, exchange of communications, or pleadings) and may be a clause within a contract or a separate agreement. The basis for any arbitration / dispute-resolution clause.',
    confidence: 'high',
    topics: ['arbitration', 'dispute-resolution', 'contract'],
    appliesTo: ['nda', 'promissory_note', 'employment_offer'],
  },
  {
    id: 'succession.63',
    act: 'Indian Succession Act, 1925',
    actShort: 'Succession Act',
    section: '63',
    title: 'Execution of unprivileged wills',
    summary:
      'The testator must sign/affix a mark (or another sign on the testator’s direction in their presence), intending thereby to give effect to the will, and the will must be attested by two or more witnesses who each saw the testator sign and signed in the testator’s presence. Applies to wills of Hindus, Christians and Parsis (not Muslims, governed by personal law).',
    confidence: 'high',
    verifyNote:
      'Muslim wills are governed by personal (Shariat) law, not §63. Confirm the testator’s personal law applies.',
    topics: ['will', 'succession', 'estate'],
    appliesTo: ['will'],
  },
  {
    id: 'poa.1882',
    act: 'Powers of Attorney Act, 1882',
    actShort: 'PoA Act',
    title: 'Powers of Attorney Act, 1882',
    summary:
      'Governs the execution and effect of powers of attorney. Acts done by the donee in the donor’s name bind the donor. A PoA is generally excluded from electronic execution (IT Act Schedule 1) and a PoA conferring an interest in immovable property worth ₹100+ typically requires registration.',
    confidence: 'high',
    topics: ['power-of-attorney', 'agency'],
    appliesTo: ['power_of_attorney'],
    commonlyPairedWith: ['registration.17', 'it.3a'],
  },
  {
    id: 'gratuity.4',
    act: 'Payment of Gratuity Act, 1972',
    actShort: 'Gratuity Act',
    section: '4',
    title: 'Payment of gratuity',
    summary:
      'Gratuity is payable to an employee on termination after at least five years of continuous service (the five-year condition is waived on death/disablement), at 15 days’ wages for every completed year of service, subject to the statutory maximum.',
    confidence: 'moderate',
    verifyNote:
      'The statutory ceiling has been revised by notification (₹20 lakh at last revision). Confirm the current cap before relying on it.',
    topics: ['employment', 'gratuity', 'terminal-benefits'],
    appliesTo: ['employment_offer'],
  },
  {
    id: 'stamp.17',
    act: 'Indian Stamp Act, 1899',
    actShort: 'Stamp Act',
    section: '17',
    title: 'Instruments to be stamped before or at the time of execution',
    summary:
      'Chargeable instruments executed in India must be stamped before or at the time of execution. An unstamped/insufficiently-stamped instrument is generally inadmissible in evidence until the deficit duty and penalty are paid. Rates are heavily amended by each State.',
    confidence: 'moderate',
    verifyNote:
      'Stamp duty rates and many procedural provisions are governed by State amendments / State Stamp Acts — always check the State where the instrument is executed.',
    topics: ['stamp-duty', 'execution', 'admissibility'],
    appliesTo: ['rent_agreement', 'promissory_note', 'power_of_attorney'],
  },
  {
    id: 'dpdp.2023',
    act: 'Digital Personal Data Protection Act, 2023',
    actShort: 'DPDP Act',
    title: 'Digital Personal Data Protection Act, 2023',
    summary:
      'India’s comprehensive data-protection statute. Processing of digital personal data generally requires the data principal’s consent (or a legitimate use), notice of purpose, and grants rights of access/correction/erasure/grievance redressal. Data fiduciaries owe security and breach-notification duties. Operative provisions commence as notified with the Rules.',
    confidence: 'moderate',
    verifyNote:
      'The Act commences in phases as the DPDP Rules are notified — confirm which provisions are in force at the relevant date.',
    topics: ['data-protection', 'privacy', 'consent'],
    appliesTo: ['nda'],
  },

  // ── 2024 criminal-code remaps (section numbers: VERIFY) ───────────────────
  {
    id: 'bnss.173',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '173',
    title: 'Information in cognizable cases (FIR)',
    summary:
      'Registration of first information in cognizable offences. Successor to CrPC §154.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.154',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['fir', 'criminal'],
  },
  {
    id: 'bnss.223',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '223',
    title: 'Cognizance of offence on complaint to a Magistrate',
    summary:
      'Magistrate taking cognizance on a complaint. Successor to CrPC §200.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.200',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['complaint', 'criminal'],
  },
  {
    id: 'bnss.482',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '482',
    title: 'Anticipatory bail (direction for grant of bail before arrest)',
    summary:
      'Pre-arrest bail: where a person apprehends arrest for a non-bailable offence, the High Court or the Court of Session may direct that, in the event of arrest, the person be released on bail (and may impose conditions under sub-section (2)). Successor to CrPC §438. NOTE the renumbering trap — under the old CrPC §482 was the High Court’s inherent powers; under BNSS that is §528.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.438',
    confidence: 'high',
    verifyNote:
      'Anticipatory bail lies only before the Court of Session or the High Court; some offences are statutorily excluded — verify against the bare act before filing.',
    topics: ['bail', 'criminal'],
    appliesTo: ['anticipatory_bail'],
    commonlyPairedWith: ['bnss.480', 'bnss.483'],
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/20062',
  },
  {
    id: 'bns.103',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '103',
    title: 'Punishment for murder',
    summary: 'Offence of murder. Successor to IPC §302.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.302',
    confidence: 'moderate',
    verifyNote: VERIFY,
    topics: ['criminal'],
  },
  {
    id: 'bns.318',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '318',
    title: 'Cheating',
    summary:
      'Cheating and dishonestly inducing delivery of property (IPC §420 maps to §318(4)). Successor to IPC §§415–420.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.420',
    confidence: 'moderate',
    verifyNote: VERIFY,
    topics: ['criminal', 'fraud'],
  },
  {
    id: 'bns.106',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '106',
    title: 'Causing death by negligence',
    summary:
      'Death caused by a rash/negligent act not amounting to culpable homicide; §106(2) deals with the hit-and-run scenario. Successor to IPC §304A.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.304A',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'negligence'],
  },
  {
    id: 'bns.85',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '85',
    title: 'Cruelty to a woman by husband or his relatives',
    summary:
      'Subjecting a woman to cruelty by her husband or his relatives ("cruelty" is defined in §86). Successor to IPC §498A.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.498A',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'family', 'cruelty'],
  },
  {
    id: 'bns.80',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '80',
    title: 'Dowry death',
    summary:
      'Death of a woman within seven years of marriage caused by burns/bodily injury or otherwise than under normal circumstances, where she was subjected to dowry-related cruelty. Successor to IPC §304B.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.304B',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'family', 'dowry'],
  },
  {
    id: 'bns.152',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '152',
    title: 'Act endangering sovereignty, unity and integrity of India',
    summary:
      'Nearest analogue to the repealed offence of sedition. NOT a 1:1 rename — the colonial sedition offence (IPC §124A) was dropped and §152 is a NEW offence with different ingredients (secession/armed rebellion/subversive activities, including by electronic/financial means). Cite with care; the elements differ materially.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.124A',
    confidence: 'moderate',
    verifyNote:
      'Not a renumbering: sedition (IPC §124A) was repealed and §152 is a distinct new offence. Confirm the ingredients before treating it as the "successor".',
    topics: ['criminal', 'state'],
  },
  {
    id: 'bns.356',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '356',
    title: 'Defamation',
    summary:
      'Defamation: the offence is defined in §356(1) and the punishment (incl. community service) in §356(2). Successor to IPC §§499–500.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.500',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'defamation'],
  },
  {
    id: 'bns.351',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '351',
    title: 'Criminal intimidation',
    summary:
      'Criminal intimidation; punishment in §351(2)/(3). Successor to IPC §506.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.506',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal'],
  },
  {
    id: 'bns.303',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '303',
    title: 'Theft',
    summary:
      'Theft is defined in §303(1) and the punishment in §303(2). Successor to IPC §379.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.379',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'property'],
  },
  {
    id: 'bns.309',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '309',
    title: 'Robbery',
    summary:
      'Robbery (defined at §309(2); punishment at §309(4)). Successor to IPC §392.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.392',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'property'],
  },
  {
    id: 'bns.316',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '316',
    title: 'Criminal breach of trust',
    summary:
      'Criminal breach of trust (defined at §316(1); punishment at §316(2)). Successor to IPC §§405–406.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.406',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal', 'fraud'],
  },
  {
    id: 'bns.115',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '115',
    title: 'Voluntarily causing hurt',
    summary:
      'Voluntarily causing hurt; punishment in §115(2). Successor to IPC §323.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.323',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal'],
  },
  {
    id: 'bns.64',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '64',
    title: 'Punishment for rape',
    summary:
      'Punishment for rape (the offence is defined in §63, successor to IPC §375). Successor to IPC §376.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.376',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal'],
  },
  {
    id: 'bns.74',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '74',
    title: 'Assault or criminal force to a woman with intent to outrage her modesty',
    summary:
      'Assault/criminal force on a woman intending to outrage her modesty. Successor to IPC §354.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.354',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal'],
  },
  {
    id: 'bns.137',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '137',
    title: 'Kidnapping',
    summary:
      'Kidnapping (defined at §137(1); punishment at §137(2)). Successor to IPC §363.',
    effectiveFrom: '2024-07-01',
    supersedes: 'ipc.363',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['criminal'],
  },

  // ── CrPC → BNSS (procedural remaps; section numbers: VERIFY) ───────────────
  {
    id: 'bnss.144',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '144',
    title: 'Order for maintenance of wife, children and parents',
    summary:
      'Summary remedy directing maintenance for a wife, children or parents unable to maintain themselves. Successor to CrPC §125.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.125',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['maintenance', 'family', 'criminal'],
  },
  {
    id: 'bnss.163',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '163',
    title: 'Power to issue order in urgent cases of nuisance or apprehended danger',
    summary:
      'Magistrate’s power to issue prohibitory / preventive orders in urgent cases. Successor to CrPC §144.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.144',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['preventive', 'criminal'],
  },
  {
    id: 'bnss.175',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '175',
    title: 'Police officer’s power to investigate cognizable cases (Magistrate may order investigation)',
    summary:
      'Investigation of cognizable cases; the Magistrate’s power to order investigation (the old §156(3) remedy) is at §175(3). Successor to CrPC §156.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.156',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['investigation', 'criminal'],
  },
  {
    id: 'bnss.180',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '180',
    title: 'Examination of witnesses by police',
    summary:
      'Oral examination of witnesses by the investigating officer. Successor to CrPC §161.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.161',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['investigation', 'criminal'],
  },
  {
    id: 'bnss.183',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '183',
    title: 'Recording of confessions and statements',
    summary:
      'Recording of confessions and statements by a Magistrate. Successor to CrPC §164.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.164',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['investigation', 'criminal'],
  },
  {
    id: 'bnss.35',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '35',
    title: 'When police may arrest without warrant',
    summary:
      'Circumstances in which police may arrest without a warrant; the old §41A notice-of-appearance safeguards are folded into §35(3)–(7). Successor to CrPC §§41 and 41A.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.41',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['arrest', 'criminal'],
  },
  {
    id: 'bnss.480',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '480',
    title: 'When bail may be taken in non-bailable offences',
    summary:
      'Grant of bail by a court in non-bailable offences. Successor to CrPC §437.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.437',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['bail', 'criminal'],
  },
  {
    id: 'bnss.483',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '483',
    title: 'Special powers of High Court and Court of Session regarding bail',
    summary:
      'High Court / Sessions Court powers to grant bail and to impose or modify conditions. Successor to CrPC §439.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.439',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['bail', 'criminal'],
  },
  {
    id: 'bnss.478',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '478',
    title: 'In what cases bail to be taken (bailable offences)',
    summary:
      'Bail as of right in bailable offences. Successor to CrPC §436.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.436',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['bail', 'criminal'],
  },
  {
    id: 'bnss.359',
    act: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    actShort: 'BNSS',
    section: '359',
    title: 'Compounding of offences',
    summary:
      'Offences that may be compounded, and those compoundable only with the court’s permission. Successor to CrPC §320.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.320',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['compounding', 'criminal'],
  },

  // ── Indian Evidence Act → BSA (section numbers: VERIFY) ────────────────────
  {
    id: 'bsa.63',
    act: 'Bharatiya Sakshya Adhiniyam, 2023',
    actShort: 'BSA',
    section: '63',
    title: 'Admissibility of electronic records',
    summary:
      'Conditions for admitting electronic/digital records as evidence; the certificate requirement (old §65B(4)) is at §63(4)(c). Successor to Indian Evidence Act §65B.',
    effectiveFrom: '2024-07-01',
    supersedes: 'evidence.65B',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['evidence', 'electronic-records'],
  },
  {
    id: 'bsa.39',
    act: 'Bharatiya Sakshya Adhiniyam, 2023',
    actShort: 'BSA',
    section: '39',
    title: 'Opinions of experts',
    summary:
      'Relevance of expert opinion; §39(2) carries the old §45A (electronic-evidence examiner). Successor to Indian Evidence Act §45.',
    effectiveFrom: '2024-07-01',
    supersedes: 'evidence.45',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['evidence', 'expert'],
  },
  {
    id: 'bsa.26',
    act: 'Bharatiya Sakshya Adhiniyam, 2023',
    actShort: 'BSA',
    section: '26',
    title: 'Cases in which a statement of a person who cannot be called as a witness is relevant (incl. dying declaration)',
    summary:
      'Relevance of statements by persons who are dead or cannot be found/called; the dying declaration is §26(a). Successor to Indian Evidence Act §32. (Note: BSA §30 is "statements in maps/charts/plans" — do NOT use it for dying declarations.)',
    effectiveFrom: '2024-07-01',
    supersedes: 'evidence.32',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['evidence', 'dying-declaration'],
  },
  {
    id: 'bsa.23',
    act: 'Bharatiya Sakshya Adhiniyam, 2023',
    actShort: 'BSA',
    section: '23',
    title: 'Confession to police officer or while in custody not provable',
    summary:
      'Bars confessions made to a police officer (§23(1)) and confessions made in custody unless in the immediate presence of a Magistrate (§23(2)); §23 also absorbs the old §27 proviso. Successor to Indian Evidence Act §§25–27.',
    effectiveFrom: '2024-07-01',
    supersedes: 'evidence.25',
    confidence: 'high',
    verifyNote: VERIFY,
    topics: ['evidence', 'confession'],
  },
];

const BY_ID = new Map(CITATIONS.map((c) => [c.id, c]));

export function getCitation(id: string): Citation | undefined {
  return BY_ID.get(id);
}

export function citationsForTopic(topic: string): Citation[] {
  return CITATIONS.filter((c) => c.topics?.includes(topic));
}

/** Format a citation for display, e.g. "BNSS §223 — Cognizance of offence on complaint". */
export function formatCitation(c: Citation): string {
  const head = c.section
    ? `${c.actShort ?? c.act} §${c.section}`
    : (c.actShort ?? c.act);
  return `${head} — ${c.title}`;
}

/** One of the three repealed colonial-era codes that the 2024 reform replaced. */
export type RepealedCode = 'IPC' | 'CrPC' | 'Evidence Act';

/**
 * A single old→new section mapping, derived from a successor citation's
 * `supersedes` pointer (e.g. bnss.223 supersedes 'crpc.200'). Powers the
 * "CrPC→BNSS diff" / reform-lookup tool in the UI.
 */
export interface ReformRemap {
  /** Repealed code the old reference belonged to. */
  code: RepealedCode;
  /** Repealed section number string (e.g. '200', '498A'). */
  repealedSection: string;
  /** Repealed citation id (e.g. 'crpc.200') — matches `Citation.supersedes`. */
  repealedId: string;
  /** Display label for the old reference (e.g. 'CrPC §200'). */
  repealedLabel: string;
  /** The current provision that replaced it. */
  successor: Citation;
}

const PREFIX_TO_CODE: Record<string, RepealedCode> = {
  ipc: 'IPC',
  crpc: 'CrPC',
  evidence: 'Evidence Act',
};

/** Leading-integer of a section string, for numeric-ish sorting ('304A' → 304). */
function sectionOrder(section: string): number {
  const n = parseInt(section, 10);
  return Number.isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
}

/**
 * Every old→new criminal-reform mapping the curated catalog knows, built from
 * the `supersedes` pointers on the BNS/BNSS/BSA citations. Sorted by code then
 * section number. This is the data behind the reform-lookup / diff tool — no
 * statute numbers are authored here, they're read off the citations.
 */
export function reformRemaps(): ReformRemap[] {
  const out: ReformRemap[] = [];
  for (const c of CITATIONS) {
    if (!c.supersedes) continue;
    const dot = c.supersedes.indexOf('.');
    if (dot < 0) continue;
    const prefix = c.supersedes.slice(0, dot);
    const section = c.supersedes.slice(dot + 1);
    const code = PREFIX_TO_CODE[prefix];
    if (!code || !section) continue;
    out.push({
      code,
      repealedSection: section,
      repealedId: c.supersedes,
      repealedLabel: `${code} §${section}`,
      successor: c,
    });
  }
  const codeRank: Record<RepealedCode, number> = {
    IPC: 0,
    CrPC: 1,
    'Evidence Act': 2,
  };
  return out.sort(
    (a, b) =>
      codeRank[a.code] - codeRank[b.code] ||
      sectionOrder(a.repealedSection) - sectionOrder(b.repealedSection) ||
      a.repealedSection.localeCompare(b.repealedSection),
  );
}
