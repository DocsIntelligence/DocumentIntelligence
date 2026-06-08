/**
 * Pure HTML builders for rendering captured signatures onto a document and an
 * audit page. Shared by the API (PDF render payload) and the app (live
 * preview) so both produce identical output. No framework deps — returns
 * HTML strings the freeform template renders.
 *
 * These are in-app drawn/typed/uploaded signatures (visual + metadata), NOT a
 * certified eSignature. The audit page states that explicitly.
 */

export interface SignatureSignerInput {
  name: string;
  email?: string | null;
  role: string;
  status: string;
  /** 'draw' | 'upload' | 'typed' | provider key */
  method?: string | null;
  image?: string | null;
  typedText?: string | null;
  font?: string | null;
  signedAt?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  party_a: 'Party A',
  party_b: 'Party B',
  witness: 'Witness',
  lawyer: 'Lawyer',
  custom: 'Signatory',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-IN');
}

/** One signer's signature cell (image / typed / blank line for pending). */
function signerCell(s: SignatureSignerInput): string {
  const signed = s.status === 'signed';
  let mark: string;
  if (signed && s.image) {
    mark = `<img src="${s.image}" alt="signature" style="height:46px;max-width:100%;object-fit:contain" />`;
  } else if (signed && s.typedText) {
    mark = `<span style="font-family:'Segoe Script','Brush Script MT',cursive;font-size:20pt;line-height:46px">${esc(
      s.typedText,
    )}</span>`;
  } else {
    // Pending: leave a blank ruled space to sign by hand.
    mark = `<span style="display:inline-block;height:46px"></span>`;
  }
  const meta = signed
    ? `Signed${s.signedAt ? ' · ' + esc(fmtDate(s.signedAt)) : ''}`
    : 'Signature: _______________';
  const sub = `${esc(roleLabel(s.role))}${s.email ? ' · ' + esc(s.email) : ''}`;
  return `
    <div style="display:inline-block;width:46%;margin:0 1.5% 20pt;vertical-align:top">
      <div style="min-height:46px">${mark}</div>
      <div style="border-top:1px solid #333;margin-top:4pt;padding-top:3pt;font-size:10.5pt">
        <strong>${esc(s.name)}</strong><br/>
        <span style="color:#444">${sub}</span><br/>
        <span style="color:#666;font-size:9.5pt">${meta}</span>
      </div>
    </div>`;
}

/**
 * The signature block appended at the end of the document body (flows after
 * existing content; no forced page break before it).
 */
export function buildSignatureBlockHtml(
  signers: SignatureSignerInput[],
): string {
  if (!signers.length) return '';
  const cells = signers.map(signerCell).join('');
  return `
    <div class="signature-block" style="margin-top:28pt">
      <h2 style="font-size:12pt;margin:0 0 12pt">Signatures</h2>
      <div>${cells}</div>
    </div>`;
}

/**
 * A standalone audit page (preceded by a forced page break) listing the
 * capture metadata for every signer who has signed.
 */
export function buildSignatureAuditHtml(
  signers: SignatureSignerInput[],
): string {
  const signed = signers.filter((s) => s.status === 'signed');
  if (!signed.length) return '';
  const rows = signed
    .map(
      (s) => `
      <tr>
        <td style="border:1px solid #ccc;padding:4pt 6pt">${esc(s.name)}</td>
        <td style="border:1px solid #ccc;padding:4pt 6pt">${esc(
          roleLabel(s.role),
        )}</td>
        <td style="border:1px solid #ccc;padding:4pt 6pt">${esc(
          s.method ?? '',
        )}</td>
        <td style="border:1px solid #ccc;padding:4pt 6pt">${esc(
          fmtDate(s.signedAt),
        )}</td>
        <td style="border:1px solid #ccc;padding:4pt 6pt">${esc(
          s.ip ?? '',
        )}</td>
      </tr>`,
    )
    .join('');
  return `
    <div data-page-break></div>
    <div class="signature-audit">
      <h2 style="font-size:12pt;margin:0 0 12pt">Signature audit trail</h2>
      <table style="width:100%;border-collapse:collapse;font-size:10pt">
        <thead>
          <tr>
            <th style="border:1px solid #ccc;padding:4pt 6pt;text-align:left">Name</th>
            <th style="border:1px solid #ccc;padding:4pt 6pt;text-align:left">Role</th>
            <th style="border:1px solid #ccc;padding:4pt 6pt;text-align:left">Method</th>
            <th style="border:1px solid #ccc;padding:4pt 6pt;text-align:left">Signed at</th>
            <th style="border:1px solid #ccc;padding:4pt 6pt;text-align:left">IP</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:10pt;font-size:9pt;color:#666">
        Signatures captured in-app (drawn, typed, or uploaded) with the metadata
        above. This is an electronic record of consent, not a certified
        (Aadhaar/DSC) eSignature.
      </p>
    </div>`;
}

/** Convenience: block + audit, appended to a document's body HTML. */
export function appendSignaturesToHtml(
  bodyHtml: string,
  signers: SignatureSignerInput[],
): string {
  if (!signers.length) return bodyHtml;
  return (
    bodyHtml +
    buildSignatureBlockHtml(signers) +
    buildSignatureAuditHtml(signers)
  );
}
