/**
 * Server-side structural scaffolds for court/legal document presets (keys match
 * `DOCUMENT_PRESETS` in @org/legal-reference). Appended to the generation system
 * prompt so the AI produces a document in the expected Indian drafting shape.
 * Kept server-side so prompt internals aren't shipped to the client.
 */

const COURT_FILING = `Format as a formal Indian court filing:
1. Cause title — the court name and case caption (use {{court_name}} and {{case_number}} placeholders).
2. Memorandum of parties (applicant/petitioner/plaintiff vs respondent/defendant, with full addresses).
3. Numbered paragraphs of facts.
4. Numbered grounds.
5. Prayer — begin "It is, therefore, most respectfully prayed that this Hon'ble Court may be pleased to ...".
6. Verification clause (place, date, signature of the deponent).
7. Advocate block — {{advocate_name}}, Enrolment No. {{bar_number}}, counsel for the {{party_role}}.
Use respectful court register. Do not invent case numbers or section numbers — use placeholders.`;

const NOTICE = `Format as a formal pre-litigation legal notice:
- Sender's name/address and date; "Through counsel" line if applicable.
- Recipient's name and address; "Subject:" line.
- Numbered paragraphs of facts.
- A clear demand and the time period to comply.
- Consequence of non-compliance (legal proceedings).
- Signature / advocate block.`;

export const COURT_SCAFFOLDS: Record<string, string> = {
  'legal-notice-138': `${NOTICE}
This is a statutory notice for a dishonoured cheque under Section 138 of the Negotiable Instruments Act, 1881. State the cheque particulars, the dishonour and reason, and demand payment within 15 days of receipt. Section 138 NI Act is current law (unaffected by the 2024 criminal-code reform) and may be cited.`,

  'legal-notice-general': NOTICE,

  'consumer-complaint': `${COURT_FILING}
This is a complaint under the Consumer Protection Act, 2019 before the appropriate Consumer Disputes Redressal Commission. Address the District/State/National forum per the pecuniary value; include particulars of the goods/services, the deficiency, and the relief (refund/replacement/compensation).`,

  'bail-regular': `${COURT_FILING}
This is an application for REGULAR bail. Reference the current Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023 — NOT the repealed CrPC. State the FIR/case number, police station, offences alleged, period in custody, and grounds for bail. Use {{applicable_law}} where a precise section is needed.`,

  'bail-anticipatory': `${COURT_FILING}
This is an application for ANTICIPATORY (pre-arrest) bail under the BNSS, 2023 (successor to CrPC §438). State the apprehension of arrest, the FIR particulars, grounds, and an undertaking to cooperate with the investigation. Use {{applicable_law}} for precise sections; do not cite repealed CrPC provisions.`,

  plaint: `${COURT_FILING}
This is a plaint instituting a civil suit. Include jurisdiction, cause of action with dates, the relief claimed, and suit valuation/court-fee paragraph.`,

  'written-statement': `${COURT_FILING}
This is a written statement (defence). Begin with preliminary objections, then a para-wise reply to the plaint, then the defendant's own version, then the prayer to dismiss the suit.`,

  vakalatnama: `Format as a vakalatnama (advocate authorisation):
- Title and case caption ({{court_name}}, {{case_number}}).
- The client appoints {{advocate_name}} (Enrolment No. {{bar_number}}) as counsel.
- Standard authorisations (to appear, plead, file, compromise with consent, receive documents, etc.).
- Acceptance by the advocate; client signature; date and place.`,

  'affidavit-general': `Format as a sworn affidavit:
- Deponent's name, age, parentage, and address.
- "I, the above-named deponent, do solemnly affirm and declare as under:" then numbered statements.
- A verification clause: "Verified at {{place}} on {{date}} that the contents of the above affidavit are true and correct to my knowledge and belief."
- Deponent signature line.`,

  'rti-application': `Format as an application under the Right to Information Act, 2005:
- Addressed to the Public Information Officer of {{department}}.
- Applicant's name and address.
- A numbered list of the specific information sought, with the relevant period.
- A line on the application fee and a request to transfer to the correct PIO if misdirected.`,

  'writ-petition': `${COURT_FILING}
This is a writ petition under Article 226 (High Court) or Article 32 (Supreme Court). Include the writ sought (mandamus/certiorari/prohibition/quo warranto/habeas corpus), the right affected, the facts, the grounds, and that no equally efficacious alternative remedy exists. Use {{applicable_law}} for precise provisions.`,

  will: `Format as a last will and testament:
- Declaration of identity, soundness of mind, and that this revokes all earlier wills.
- Appointment of an executor.
- Specific bequests and the residuary clause.
- Attestation clause with TWO witnesses (name, address, signature).
Note: a will cannot be executed by Aadhaar eSign (IT Act Schedule 1) — it needs wet signatures and witnesses.`,

  gpa: `Format as a power of attorney:
- Identify the principal (grantor) and the attorney (grantee) with addresses.
- State whether it is general or special, and the specific powers granted (numbered).
- Duration / revocation clause.
- Execution block; note that a PoA typically requires notarisation/registration and is NOT valid via Aadhaar eSign (IT Act Schedule 1).`,
};

const AGREEMENT = `Format as a formal Indian commercial agreement:
- Title and date; parties with addresses ("between ... (hereinafter ...)").
- Recitals ("WHEREAS ...").
- Numbered operative clauses (definitions, obligations, term, termination, confidentiality, governing law & jurisdiction, dispute resolution).
- Signature blocks for both parties, with witness lines where customary.
Keep party-specific values as {{placeholders}}.`;

for (const k of [
  'nda',
  'mou',
  'partnership-deed',
  'offer-letter',
  'gift-deed',
  // newer agreement presets share the commercial-agreement shape
  'service-agreement',
  'loan-agreement',
  'promissory-note',
  'leave-licence',
  'sale-agreement',
]) {
  COURT_SCAFFOLDS[k] = AGREEMENT;
}

const AFFIDAVIT = COURT_SCAFFOLDS['affidavit-general'];
for (const k of ['affidavit-name-change', 'affidavit-income', 'affidavit-gap']) {
  COURT_SCAFFOLDS[k] = AFFIDAVIT;
}

// Additional notices reuse the pre-litigation NOTICE shape.
COURT_SCAFFOLDS['rent-eviction-notice'] = `${NOTICE}
This is a notice to quit / vacate. Recite the tenancy (date, premises, rent), the ground (expiry of term, default in rent, breach), and call upon the tenant to clear arrears and hand over vacant possession within the notice period. Reference the Transfer of Property Act, 1882 §106 and the applicable State Rent Control Act framing; use {{applicable_law}} where a precise State provision is needed.`;
COURT_SCAFFOLDS['employment-termination-notice'] = `${NOTICE}
This is an employment show-cause / termination notice from an employer. Recite the appointment terms, the alleged misconduct/non-performance with dates, and call upon the employee to respond or show cause within the period. Keep it within the contract and applicable labour law; do not assert criminal allegations.`;
COURT_SCAFFOLDS['public-notice'] = `Format as a newspaper public notice:
- A bold subject line and the issuing party (or "through counsel").
- A short statement of the facts giving rise to the notice (lost document / intended purchase / objection invited).
- An invitation to any person with a claim or objection to communicate in writing within a stated number of days, and the consequence of silence.
Keep it concise — public notices are short.`;

// Additional court filings reuse the COURT_FILING shape with subject framing.
COURT_SCAFFOLDS['mutual-divorce-petition'] = `${COURT_FILING}
This is a JOINT petition for divorce by mutual consent under §13B of the Hindu Marriage Act, 1955 (or §28 of the Special Marriage Act, 1954). State the marriage particulars, the period of separation, that the parties cannot live together and have freely consented, and annex the terms of settlement (custody, maintenance, alimony, stridhan). Do not guess the section if the governing personal law is unclear — use {{applicable_law}}.`;
COURT_SCAFFOLDS['maintenance-application'] = `${COURT_FILING}
This is a maintenance application under §144 of the Bharatiya Nagarik Suraksha Sanhita, 2023 (successor to CrPC §125) — do NOT cite the repealed CrPC. State the relationship, the respondent's means, the applicant's inability to maintain herself/himself, and the monthly maintenance claimed. Use {{applicable_law}} for the precise provision.`;
COURT_SCAFFOLDS['domestic-violence-complaint'] = `${COURT_FILING}
This is an application under the Protection of Women from Domestic Violence Act, 2005. Establish the domestic relationship and shared household, narrate the acts of domestic violence (physical/emotional/economic/sexual) with dates, and pray for protection, residence, monetary relief, custody and compensation orders.`;

COURT_SCAFFOLDS['indemnity-bond'] = `Format as an indemnity bond on stamp paper:
- Identify the executant and the party indemnified, with addresses.
- "WHEREAS" recitals setting out the circumstances (lost original / duplicate sought / disbursement made).
- The operative undertaking to indemnify and keep indemnified against loss, claims, demands and proceedings, up to a stated amount.
- Execution block with witnesses. Reference the contract of indemnity under §124 of the Indian Contract Act, 1872.`;

COURT_SCAFFOLDS['appointment-letter'] = `Format as a formal employment appointment letter on company letterhead:
- Date, employee name/address, post and effective date.
- Numbered terms: remuneration, working hours, leave, probation, confidentiality, IP assignment, code of conduct, notice/termination.
- A line requiring the employee to sign a duplicate in acceptance.
Keep company- and salary-specific values as {{placeholders}}.`;
COURT_SCAFFOLDS['experience-certificate'] = `Format as a short experience-cum-relieving certificate on company letterhead:
- "This is to certify that {{employee_name}} was employed as {{designation}} from {{from_date}} to {{to_date}}."
- A line on conduct/performance and that no dues are pending.
- A relieving line with effect from the relieving date, and an authorised signatory block.`;
COURT_SCAFFOLDS['board-resolution'] = `Format as a certified true copy of a board resolution:
- Company name/CIN, date and place of the board meeting.
- "RESOLVED THAT ..." operative text, followed by an authorisation to a named person to give effect to it.
- Certification line by a Director / Company Secretary with signature.`;

COURT_SCAFFOLDS['noc'] = `Format as a no-objection certificate:
- Issuer's name and capacity (landlord / employer / parent / society / co-owner).
- "I/We have no objection to ..." stating the specific purpose only.
- Date and signature. Keep it short and limited to the stated purpose.`;

COURT_SCAFFOLDS['rti-first-appeal'] = `Format as a first appeal under §19(1) of the Right to Information Act, 2005:
- Addressed to the First Appellate Authority of the public authority.
- Reference the original RTI (date and number) and the PIO's reply or the deemed refusal (no reply in 30 days).
- Numbered grounds of appeal (incomplete / misleading / wrongful denial).
- Prayer that the information be directed to be furnished.`;

// More commercial agreements share the AGREEMENT shape.
for (const k of [
  'consulting-agreement',
  'master-services-agreement',
  'saas-agreement',
  'employment-agreement',
  'shareholders-agreement',
  'sale-of-goods-agreement',
]) {
  COURT_SCAFFOLDS[k] = AGREEMENT;
}

const LETTER = `Format as a formal business letter on the organisation's letterhead:
- Date; recipient's name and address; a clear subject line.
- A courteous opening, the substance in short paragraphs, and a clear closing/next step.
- Signature block (name, designation, organisation).
Keep names, dates, and amounts as {{placeholders}} where unknown.`;

for (const k of [
  'internship-offer',
  'termination-letter',
  'resignation-letter',
  'recommendation-letter',
  'warning-letter',
  'authorization-letter',
]) {
  COURT_SCAFFOLDS[k] = LETTER;
}

const POLICY = `Format as a clear, well-structured policy document:
- A title and an effective date.
- Numbered/headed sections in plain, readable language.
- Where the law requires specific disclosures (data collected, user rights, grievance/contact), include them as distinct sections.
Use {{placeholders}} for company name, website, and contact details. Do not invent statutory section numbers — use {{applicable_law}} if a precise reference is needed.`;

for (const k of ['privacy-policy', 'terms-of-service', 'refund-policy']) {
  COURT_SCAFFOLDS[k] = POLICY;
}

COURT_SCAFFOLDS['invoice'] = `Format as a clean commercial invoice:
- Seller (with tax ID/GSTIN) and buyer details; invoice number and date.
- A line-item table (description, qty, rate, amount).
- Subtotal, tax (e.g. GST/CGST/SGST where applicable), and total.
- Payment terms, due date, and bank/UPI details.
Keep figures and identifiers as {{placeholders}}.`;

COURT_SCAFFOLDS['quotation'] = `Format as a price quotation/estimate: provider and client, a line-item table with quantities and unit prices, the total, validity period, and terms. Keep figures as {{placeholders}}.`;

COURT_SCAFFOLDS['statement-of-work'] = `${AGREEMENT}
This is a Statement of Work under a Master Services Agreement. Include: reference to the MSA (date), project description, detailed scope, deliverables, timeline/milestones, fees and payment schedule, and acceptance criteria. Defined terms not set out here take their meaning from the MSA.`;

COURT_SCAFFOLDS['data-processing-agreement'] = `${AGREEMENT}
This is a Data Processing Agreement. Include: roles (controller/fiduciary vs processor), subject matter and duration, categories of personal data and data subjects, processing only on documented instructions, security measures, sub-processor terms, breach notification, audit rights, and return/deletion on termination. Reference the DPDP Act, 2023 (India) and, where relevant, GDPR Article 28 via {{applicable_law}}.`;

COURT_SCAFFOLDS['term-sheet'] = `${AGREEMENT}
This is a NON-BINDING investment term sheet (except confidentiality and exclusivity). Include: parties, investment amount and instrument, valuation and resulting equity, liquidation preference, anti-dilution, board composition, founder vesting, information rights, conditions precedent, and a clear non-binding statement.`;

COURT_SCAFFOLDS['board-meeting-minutes'] = `Format as minutes of a meeting:
- Company/body name, type of meeting, date, time and place; attendees and quorum.
- Numbered agenda items with the discussion and the decision/resolution for each.
- Resolutions in "RESOLVED THAT ..." form where applicable.
- Time of conclusion and a signature line for the chairperson.`;

COURT_SCAFFOLDS['non-compete'] = `${AGREEMENT}
This is a restrictive-covenant agreement. IMPORTANT for India: under §27 of the Indian Contract Act, 1872, a covenant restraining a person from carrying on a lawful profession/trade/business AFTER the term is void. Confine non-compete strictly to DURING the engagement; non-solicitation and confidentiality may extend beyond. Do not draft an enforceable post-termination non-compete for an Indian party.`;

COURT_SCAFFOLDS['rent-receipt'] = `Format as a simple rent receipt: "Received from {{tenant_name}} the sum of ₹{{amount}} towards rent of {{premises_address}} for {{period}}, paid by {{mode}}." Include the landlord's name and PAN (for HRA), the date, and a signature line.`;

COURT_SCAFFOLDS['relinquishment-deed'] = `Format as a relinquishment/release deed:
- The releasor and releasee (with relationship), and the deceased from whom the property devolved.
- A recital of how the releasor became entitled to a share.
- The operative release of all right, title and interest in the described property, voluntarily and without consideration.
- Execution with witnesses; a note that immovable-property release requires stamping and registration and cannot be eSigned (IT Act Schedule 1).`;

export function scaffoldForPreset(key?: string): string | undefined {
  return key ? COURT_SCAFFOLDS[key] : undefined;
}
