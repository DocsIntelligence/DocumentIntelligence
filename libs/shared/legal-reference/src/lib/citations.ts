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
}

const VERIFY = 'Verify the section number against the official bare act before binding use.';

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
  },
  {
    id: 'cpa.2019',
    act: 'Consumer Protection Act, 2019',
    actShort: 'CPA 2019',
    title: 'Consumer Protection Act, 2019',
    summary:
      'Governs consumer complaints. Pecuniary jurisdiction (per 2021 rules): District Commission up to ₹50 lakh, State Commission ₹50 lakh–₹2 crore, National Commission above ₹2 crore.',
    confidence: 'moderate',
    verifyNote:
      'Pecuniary limits were revised by notification; confirm current thresholds before filing.',
    topics: ['consumer'],
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
    summary: 'Pre-arrest bail. Successor to CrPC §438.',
    effectiveFrom: '2024-07-01',
    supersedes: 'crpc.438',
    confidence: 'moderate',
    verifyNote: VERIFY,
    topics: ['bail', 'criminal'],
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
