import { Injectable, Logger } from '@nestjs/common';
import { HeadlessBrowserService } from '../../common/headless-browser.service';
import type { ResolvedProfile } from './estate-profile.service';
import { EstateReportService } from './estate-report.service';

type Report = Awaited<ReturnType<EstateReportService['ownerReport']>>;
type ReportAsset = Report['assets'][number];

/**
 * Renders the Estate Report / Asset Register as a real PDF (docs/13 §10.3).
 * Self-contained: builds a print-styled HTML string and rasterises it with
 * headless Chrome (`setContent` → `pdf()`) — no Document row, no artboard
 * template, no S3/queue. Owner-facing → identifiers stay MASKED.
 */
@Injectable()
export class EstateReportPdfService {
  private readonly logger = new Logger(EstateReportPdfService.name);

  constructor(
    private readonly report: EstateReportService,
    private readonly browser: HeadlessBrowserService,
  ) {}

  async ownerReportPdf(profile: ResolvedProfile): Promise<Buffer> {
    const report = await this.report.ownerReport(profile);
    const html = renderReportHtml(report);

    const { browser, dispose } = await this.browser.acquire();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      this.logger.log(`✓ Estate report PDF (${(pdf.byteLength / 1024).toFixed(1)} KB)`);
      return Buffer.from(pdf);
    } finally {
      await dispose().catch(() => undefined);
    }
  }
}

// ── HTML rendering ───────────────────────────────────────────────────────────

function renderReportHtml(r: Report): string {
  const fmt = makeMoney(r.currency);
  const generated = new Date(r.generatedAt);
  const generatedStr = `${generated.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;

  const rows = r.assets
    .map((a, i) => assetRow(a, i, fmt))
    .join('');
  const claims = r.assets
    .filter((a) => a.howToClaim)
    .map(
      (a) =>
        `<div class="claim"><div class="claim-h">${esc(a.label)} <span class="muted">· ${esc(a.typeLabel)}</span></div><div class="claim-b">${esc(a.howToClaim)}</div></div>`,
    )
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.45; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  h2 { font-size: 13px; margin: 22px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e3e3e3; }
  .sub { color: #666; font-size: 10px; }
  .summary { display: flex; gap: 10px; margin-top: 14px; }
  .tile { flex: 1; border: 1px solid #e3e3e3; border-radius: 8px; padding: 10px 12px; }
  .tile .k { color: #666; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  .tile .v { font-size: 16px; font-weight: 600; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #666; border-bottom: 1px solid #d0d0d0; padding: 5px 6px; }
  td { padding: 6px; border-bottom: 1px solid #efefef; vertical-align: top; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: #888; }
  .pill { display: inline-block; background: #f0f0f0; border-radius: 4px; padding: 1px 5px; font-size: 9px; margin: 0 3px 2px 0; }
  .warn { color: #b4690e; }
  .claim { margin: 0 0 8px; }
  .claim-h { font-weight: 600; }
  .claim-b { color: #444; margin-top: 1px; }
  .disclaimer { margin-top: 18px; padding: 10px 12px; background: #fbf7ef; border: 1px solid #efe4cf; border-radius: 8px; font-size: 9.5px; color: #6b5a35; }
  .foot { margin-top: 16px; font-size: 9px; color: #999; }
</style></head>
<body>
  <h1>Estate Report &amp; Asset Register</h1>
  <div class="sub">Generated ${esc(generatedStr)} · a record of assets so they are not orphaned. Identifiers are masked.</div>

  <div class="summary">
    <div class="tile"><div class="k">Total value</div><div class="v">${fmt(r.totalValue)}</div></div>
    <div class="tile"><div class="k">Assets</div><div class="v">${r.assetCount}</div></div>
    <div class="tile"><div class="k">Without a nominee</div><div class="v ${r.assetsWithoutNominee ? 'warn' : ''}">${r.assetsWithoutNominee}</div></div>
  </div>

  <h2>Assets</h2>
  <table>
    <thead><tr>
      <th>Asset</th><th>Institution</th><th>Identifier</th><th>Nominees</th><th class="num">Value</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">No assets recorded.</td></tr>`}</tbody>
  </table>

  ${claims ? `<h2>How to claim</h2>${claims}` : ''}

  <div class="disclaimer">
    <strong>Important:</strong> A nominee receives <em>custody</em> of these assets, not ownership.
    Under Indian law (Sarbati Devi; Shakti Yezdani, 2023) succession follows your will or the applicable
    succession law — this register must be paired with a valid will. Claim steps above are general
    guidance, not legal advice.
  </div>

  <div class="foot">This document was generated from your Wealth Vault. Keep it with your will and tell your nominee where to find it.</div>
</body></html>`;
}

function assetRow(a: ReportAsset, i: number, fmt: (n: number) => string): string {
  const idShown = a.identifier ?? a.identifierMasked ?? '—';
  const nominees =
    a.nominees.length > 0
      ? a.nominees
          .slice()
          .sort((x, y) => x.priority - y.priority)
          .map((n) => `<span class="pill">${esc(n.name)}</span>`)
          .join('')
      : `<span class="warn">No nominee</span>`;
  const maturity = a.maturityDate
    ? `<div class="muted">Matures ${esc(new Date(a.maturityDate).toLocaleDateString('en-IN'))}</div>`
    : '';
  return `<tr>
    <td><strong>${esc(a.label)}</strong><div class="muted">${esc(a.typeLabel)}</div>${maturity}</td>
    <td>${esc(a.institution ?? '—')}</td>
    <td>${esc(idShown)}</td>
    <td>${nominees}</td>
    <td class="num">${fmt(a.value)}</td>
  </tr>`;
}

/** Locale money formatter; falls back to "<CUR> <amount>" if Intl rejects it. */
function makeMoney(currency: string): (n: number) => string {
  try {
    const f = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    });
    return (n: number) => f.format(n);
  } catch {
    return (n: number) => `${currency} ${Math.round(n).toLocaleString('en-IN')}`;
  }
}

/** Minimal HTML escaping for interpolated values. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
