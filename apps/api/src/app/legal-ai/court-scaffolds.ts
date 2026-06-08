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
]) {
  COURT_SCAFFOLDS[k] = AGREEMENT;
}

export function scaffoldForPreset(key?: string): string | undefined {
  return key ? COURT_SCAFFOLDS[key] : undefined;
}
