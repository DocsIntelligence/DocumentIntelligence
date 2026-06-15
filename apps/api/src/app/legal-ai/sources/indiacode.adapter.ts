import { Injectable, Logger } from '@nestjs/common';
import { ParsingService } from '../../intelligence/parsing.service';
import { HeadlessFetcherRegistry } from './headless-fetcher.registry';
import type {
  FetchedStatuteSection,
  LegalSourceAdapter,
} from './legal-source.interface';

const HEADLESS_TIMEOUT_MS = 25_000;
const PDF_FETCH_TIMEOUT_MS = 30_000;
const MAX_PDF_BYTES = 30 * 1024 * 1024; // 30 MB cap — bare acts rarely exceed this
const PLAIN_FETCH_UA = 'Mozilla/5.0 (compatible; LegalDraftBot/1.0)';

/** Heuristics that decide whether a plain-fetch response is "good enough" or
 *  whether we should retry through a headless browser. Plain fetch is FAST
 *  (and free), so we only escalate when the response is obviously thin:
 *    • response is &lt; 600 bytes (anti-bot / empty shell)
 *    • response is &lt;5% of an iframe-only doc with no usable body
 *    • response declared HTTP 403 / 503 / 429 / 5xx (anti-bot / overload)
 *    • renders the "please enable JavaScript" placeholder
 *    • the section-isolation pass produced nothing AND the raw text is short
 *
 * Tuned tighter on 2026-06-14 — initial thresholds were over-aggressive and
 * escalated to headless on healthy responses. Re-tune from telemetry once we
 * have real syncs to look at. */
function plainFetchLooksUsable(
  status: number,
  html: string,
  text: string,
  isolated: string | null,
): boolean {
  if (status >= 500 || status === 403 || status === 429) return false;
  if (!html || html.length < 600) return false;

  // All-iframe shell — looks like the content lives in a separate doc.
  const trimmed = html.trim();
  const iframeCount = (trimmed.match(/<iframe\b/gi) ?? []).length;
  if (iframeCount > 0 && text.length < 400) return false;

  // Visible "JS required" boilerplate is a hard tell that we got a SPA shell.
  if (/please enable javascript|requires javascript/i.test(html.slice(0, 6000))) {
    return false;
  }

  // Confident green: we isolated a section block with real content.
  if (isolated && isolated.length > 200) return true;
  // Solid green: even without isolation we have a decent text payload.
  if (text.length >= 1200) return true;
  // Mid-zone: text is thin but the HTML is sizeable + non-iframe → still
  // probably real content (e.g. table-of-contents pages we'll AI-summarise).
  if (text.length >= 600 && iframeCount === 0 && html.length >= 4000) return true;
  return false;
}

/** Decide whether a Content-Type / URL points at a PDF bare-act. We accept
 *  both standard PDF MIME types and PDF-suffixed URLs because indiacode
 *  occasionally serves PDFs through proxies that mislabel them. */
function looksLikePdf(contentType: string | null, url: string): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('application/pdf')) return true;
    if (ct.includes('application/octet-stream') && /\.pdf(?:\?|$)/i.test(url)) {
      return true;
    }
  }
  return /\.pdf(?:\?|$)/i.test(url);
}

/** Extract every PDF link from an indiacode item page. Order matters — the
 *  portal lists the bare-act PDF first, occasionally followed by amendment
 *  PDFs. Returns absolute URLs. */
function extractPdfLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const hrefRe = /href\s*=\s*["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    try {
      links.add(new URL(m[1], baseUrl).toString());
    } catch {
      /* ignore malformed url */
    }
  }
  return Array.from(links);
}

/**
 * Adapter for the Government of India's official statute portal
 * `indiacode.nic.in`. The portal hosts the bare text of every central act —
 * but doesn't expose section-level deep links uniformly, so we resort to:
 *   1. A small curated map of act-short-name → handle URL, and
 *   2. A best-effort fetch + plain-text strip of the act PDF/HTML page,
 *      followed by a section-marker scan ("**138.**", "Section 138.").
 *
 * Honest caveat: the portal's markup is inconsistent across acts. This adapter
 * gives admins a *starting point* — the AI summariser cleans up the
 * extracted text and the admin reviews+saves it. It is NOT a substitute for
 * the bare act and we do NOT auto-publish the fetched text.
 *
 * Per the agreed scope: this adapter only powers an admin-driven sync
 * action ("Pull from indiacode" button on the citation form). Drafting +
 * analysis use the curated `LegalCitation.summary` / `fullText` already in
 * the DB — never an ad-hoc fetch on the user's hot path.
 */
@Injectable()
export class IndiaCodeSourceAdapter implements LegalSourceAdapter {
  readonly jurisdiction = 'IN';
  readonly name = 'indiacode.nic.in';
  private readonly logger = new Logger(IndiaCodeSourceAdapter.name);

  constructor(
    private readonly headless: HeadlessFetcherRegistry,
    private readonly parsing: ParsingService,
  ) {}

  /**
   * Curated act → indiacode handle map. The portal uses handle-numbered URLs
   * (`/handle/123456789/<id>`). Section deep-linking isn't supported across
   * all acts, so we fetch the act page and let the AI summariser narrow.
   */
  /**
   * Curated act-short-name → indiacode handle map. Handles taken from
   * indiacode.nic.in URLs (the path segment after `/handle/123456789/`).
   * Values are admin-editable later via LegalCitation.externalUrl — this map
   * is the bootstrap. Keep entries lowercase keys for case-insensitive
   * resolution; `resolveHandle()` normalises before lookup.
   *
   * Verify each handle before relying in production — indiacode occasionally
   * shuffles them when re-publishing.
   */
  private readonly ACT_HANDLE: Record<string, string> = {
    // ── 2024 criminal reforms (replacements for IPC/CrPC/Evidence) ────────
    bns: '20062',
    'bharatiya nyaya sanhita': '20062',
    bnss: '20063',
    'bharatiya nagarik suraksha sanhita': '20063',
    bsa: '20064',
    'bharatiya sakshya adhiniyam': '20064',
    // ── Repealed-but-referenced criminal codes ────────────────────────────
    ipc: '2263',
    'indian penal code': '2263',
    crpc: '1611',
    'code of criminal procedure': '1611',
    'evidence act': '2188',
    'indian evidence act': '2188',
    // ── Contracts, property, civil procedure ──────────────────────────────
    'contract act': '2187',
    'indian contract act': '2187',
    'specific relief act': '1521',
    'transfer of property act': '2338',
    tpa: '2338',
    'sale of goods act': '2370',
    cpc: '2191',
    'code of civil procedure': '2191',
    'limitation act': '1539',
    'partnership act': '2192',
    'indian partnership act': '2192',
    'easements act': '2293',
    // ── Registration / stamp / property records ───────────────────────────
    'registration act': '2444',
    'stamp act': '2369',
    'indian stamp act': '2369',
    // ── Negotiable instruments / commerce ─────────────────────────────────
    'ni act': '2189',
    'negotiable instruments act': '2189',
    'arbitration act': '1978',
    'arbitration and conciliation act': '1978',
    'consumer protection act': '15256',
    'cpa 2019': '15256',
    // ── Companies, securities, finance ────────────────────────────────────
    'companies act': '2114',
    'companies act 2013': '2114',
    'sebi act': '1701',
    'fema': '1981',
    'foreign exchange management act': '1981',
    'rbi act': '2350',
    'reserve bank of india act': '2350',
    'banking regulation act': '2334',
    'insolvency and bankruptcy code': '2154',
    ibc: '2154',
    // ── Tax ───────────────────────────────────────────────────────────────
    'income tax act': '2435',
    'central gst act': '2076',
    'cgst act': '2076',
    'integrated gst act': '2080',
    'igst act': '2080',
    // ── Labour & employment ───────────────────────────────────────────────
    'industrial disputes act': '2363',
    'payment of wages act': '2353',
    'minimum wages act': '2356',
    'gratuity act': '2280',
    'payment of gratuity act': '2280',
    'epf act': '2354',
    'employees provident funds act': '2354',
    'shops and establishments act': '0', // state-specific; placeholder
    // ── Information / data / IT ───────────────────────────────────────────
    'it act': '1999',
    'information technology act': '1999',
    'dpdp act': '20094',
    'digital personal data protection act': '20094',
    'rti act': '1362',
    'right to information act': '1362',
    // ── Family law ────────────────────────────────────────────────────────
    'hindu marriage act': '2387',
    'hindu succession act': '2370',
    'special marriage act': '2386',
    'guardians and wards act': '2330',
    // ── Land / tenancy ────────────────────────────────────────────────────
    'rent control act': '0', // state-specific
    'land acquisition act': '2056',
    rfctlarr: '2056',
    // ── Constitutional ────────────────────────────────────────────────────
    'constitution of india': '2257',
    constitution: '2257',
  };

  async fetchSection(
    act: string,
    section: string,
  ): Promise<FetchedStatuteSection | null> {
    const handle = this.resolveHandle(act);
    if (!handle) {
      this.logger.warn(`No indiacode handle for "${act}" — admin must paste text manually.`);
      return null;
    }
    const sourceUrl = `https://www.indiacode.nic.in/handle/123456789/${handle}`;

    // ── Pass 1: plain HTTP fetch (fast + free). ────────────────────────
    const plain = await this.plainFetch(sourceUrl);
    if (plain) {
      // 1a) If the URL itself returned a PDF (some handles redirect directly),
      //     parse the PDF text layer through the existing intelligence pipeline.
      if (looksLikePdf(plain.contentType, plain.finalUrl)) {
        const pdfText = await this.extractPdfText(plain.bytes, plain.finalUrl);
        if (pdfText) {
          const isolated = this.extractSection(pdfText, section);
          return {
            text: isolated ?? pdfText.slice(0, 8000),
            sourceUrl: plain.finalUrl,
            fetchedAt: new Date(),
          };
        }
      }

      // 1b) HTML path — text-strip + section-isolate, then run the heuristic.
      const text = this.htmlToText(plain.html);
      const isolated = this.extractSection(text, section);
      if (plainFetchLooksUsable(plain.status, plain.html, text, isolated)) {
        return {
          text: isolated ?? text.slice(0, 4000),
          sourceUrl,
          fetchedAt: new Date(),
        };
      }

      // 1c) HTML is thin OR section not isolated — look for embedded PDF
      //     links on the page (the bare act is often a `.pdf` link in the
      //     item-page sidebar). Fetch + parse each in order until one yields
      //     usable text. Bounded loop (max 3 attempts) keeps cost predictable.
      const pdfLinks = extractPdfLinks(plain.html, plain.finalUrl).slice(0, 3);
      for (const link of pdfLinks) {
        const pdf = await this.plainFetch(link);
        if (!pdf || !looksLikePdf(pdf.contentType, pdf.finalUrl)) continue;
        const pdfText = await this.extractPdfText(pdf.bytes, pdf.finalUrl);
        if (!pdfText) continue;
        const isolated2 = this.extractSection(pdfText, section);
        if (isolated2 || pdfText.length > 1500) {
          this.logger.log(
            `indiacode PDF parse for ${act} §${section}: ${pdfText.length} chars from ${link}`,
          );
          return {
            text: isolated2 ?? pdfText.slice(0, 8000),
            sourceUrl: link,
            fetchedAt: new Date(),
          };
        }
      }

      this.logger.log(
        `indiacode plain fetch + PDF probe came up thin for ${act} §${section} (status=${plain.status}, bytes=${plain.html.length}, pdf-candidates=${pdfLinks.length}); trying headless fallback…`,
      );
    }

    // ── Pass 2: headless fallback (Browserless → Puppeteer → none). ─────
    const headless = this.headless.pick();
    if (!headless) {
      this.logger.warn(
        `indiacode fetch unusable for ${act} §${section} and no headless fetcher configured — returning best-effort plain text.`,
      );
      return this.bestEffort(plain, sourceUrl, section);
    }
    try {
      const rendered = await headless.fetch({
        url: sourceUrl,
        // Wait for any of these containers — the portal markup varies by act.
        // `.item-page` is DSpace's default, `.itemfiles`/`.file-link` is the
        // listing wrapper, `.bare-act` is older custom markup. Falling back
        // to `body` ensures we don't hang on a stale selector forever.
        waitForSelector:
          '.item-page, .itemfiles, .file-link, .bare-act, main, body',
        timeoutMs: HEADLESS_TIMEOUT_MS,
        userAgent: PLAIN_FETCH_UA,
      });

      // After JS hydrates, the same PDF-link extraction works — and the
      // browser may have surfaced links the static HTML didn't show.
      const renderedPdfLinks = extractPdfLinks(rendered.html, sourceUrl).slice(0, 3);
      for (const link of renderedPdfLinks) {
        const pdf = await this.plainFetch(link);
        if (!pdf || !looksLikePdf(pdf.contentType, pdf.finalUrl)) continue;
        const pdfText = await this.extractPdfText(pdf.bytes, pdf.finalUrl);
        if (!pdfText) continue;
        const isolated = this.extractSection(pdfText, section);
        if (isolated || pdfText.length > 1500) {
          this.logger.log(
            `indiacode headless+PDF (${headless.name}) recovered ${pdfText.length} chars for ${act} §${section} via ${link}`,
          );
          return {
            text: isolated ?? pdfText.slice(0, 8000),
            sourceUrl: link,
            fetchedAt: new Date(),
          };
        }
      }

      const text = this.htmlToText(rendered.html);
      const isolated = this.extractSection(text, section);
      this.logger.log(
        `indiacode headless (${headless.name}) recovered ${rendered.html.length} chars for ${act} §${section} in ${rendered.durationMs}ms`,
      );
      return {
        text: isolated ?? text.slice(0, 4000),
        sourceUrl,
        fetchedAt: new Date(),
      };
    } catch (err) {
      this.logger.error(
        `indiacode headless (${headless.name}) failed for ${act} §${section}: ${(err as Error).message}`,
      );
      return this.bestEffort(plain, sourceUrl, section);
    }
  }

  private resolveHandle(act: string): string | null {
    const norm = act.toLowerCase().trim();
    if (this.ACT_HANDLE[norm] && this.ACT_HANDLE[norm] !== '0') {
      return this.ACT_HANDLE[norm];
    }
    // Prefix match (longest first) — handles "NI Act, 1881" → "ni act" and
    // avoids "contract act" capturing "indian contract act".
    const keys = Object.keys(this.ACT_HANDLE).sort(
      (a, b) => b.length - a.length,
    );
    for (const key of keys) {
      if (this.ACT_HANDLE[key] === '0') continue;
      if (norm.includes(key)) return this.ACT_HANDLE[key];
    }
    return null;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Crude best-effort: find the marker for `section` (e.g. "138.") and
   * return text up to the next section marker. Works on the simpler indiacode
   * HTML; longer/newer acts often render as embedded PDFs — those go through
   * `extractPdfText()` and the same section-isolation runs over the parsed
   * PDF text layer.
   */
  private extractSection(text: string, section: string): string | null {
    const startRe = new RegExp(`\\b${section}\\.\\s`, 'i');
    const startMatch = startRe.exec(text);
    if (!startMatch) return null;
    const start = startMatch.index;
    // Find the next section marker (assumed numeric +1; tolerate suffixes
    // like "138A").
    const next = Number(section) + 1;
    const endRe = new RegExp(`\\b${next}[A-Z]?\\.\\s`);
    const endMatch = endRe.exec(text.slice(start + section.length));
    const slice =
      endMatch !== null
        ? text.slice(start, start + section.length + endMatch.index)
        : text.slice(start, start + 4000);
    return slice.trim();
  }

  // ── HTTP + PDF helpers ─────────────────────────────────────────────────

  /** Fetch a URL with a sane timeout + redirect following. Returns `null` on
   *  any failure (network, non-2xx after redirect, oversize). Always returns
   *  the binary body too so PDF detection can run without a second round-trip.
   *  Uses a slightly longer timeout for PDFs (which can be several MB). */
  private async plainFetch(url: string): Promise<
    | {
        status: number;
        finalUrl: string;
        contentType: string | null;
        html: string;
        bytes: Uint8Array;
      }
    | null
  > {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': PLAIN_FETCH_UA,
          Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return { status: res.status, finalUrl: res.url, contentType: res.headers.get('content-type'), html: '', bytes: new Uint8Array() };
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > MAX_PDF_BYTES) {
        this.logger.warn(
          `indiacode fetch ${url} exceeded ${MAX_PDF_BYTES} bytes — skipping.`,
        );
        return null;
      }
      const contentType = res.headers.get('content-type');
      // Only attempt UTF-8 decode for non-binary payloads — a PDF byte stream
      // decoded as UTF-8 produces noise that downstream string ops choke on.
      const isPdf = looksLikePdf(contentType, res.url);
      const html = isPdf ? '' : new TextDecoder('utf-8', { fatal: false }).decode(buf);
      return {
        status: res.status,
        finalUrl: res.url,
        contentType,
        html,
        bytes: buf,
      };
    } catch (err) {
      this.logger.warn(
        `indiacode plainFetch error for ${url}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Hand a PDF byte stream to the existing `ParsingService` — same path the
   *  upload pipeline uses for user-uploaded PDFs, with the same primary/fallback
   *  parsers (unpdf → pdf-parse). Returns the concatenated per-page text, or
   *  `null` when no parser produced a usable text layer. */
  private async extractPdfText(
    bytes: Uint8Array,
    url: string,
  ): Promise<string | null> {
    try {
      const base64 = Buffer.from(bytes).toString('base64');
      const filename = url.split('/').pop() ?? 'indiacode.pdf';
      const doc = await this.parsing.parse({
        data: base64,
        contentType: 'application/pdf',
        filename,
      });
      if (!doc) {
        this.logger.warn(
          `indiacode PDF ${url}: no parser produced usable text (likely scanned — OCR not wired into sync).`,
        );
        return null;
      }
      const text = doc.pages.map((p) => p.text).join('\n\n').trim();
      return text.length >= 200 ? text : null;
    } catch (err) {
      this.logger.warn(
        `indiacode PDF parse failed for ${url}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Last-ditch path: when headless is unavailable or errored, return whatever
   *  the plain fetch gave us (even if thin). Beats returning `null` for the
   *  caller, who can show the text + a "paste manually" hint. */
  private bestEffort(
    plain:
      | {
          status: number;
          finalUrl: string;
          contentType: string | null;
          html: string;
          bytes: Uint8Array;
        }
      | null,
    sourceUrl: string,
    section: string,
  ): FetchedStatuteSection | null {
    if (!plain || !plain.html) return null;
    const text = this.htmlToText(plain.html);
    const isolated = this.extractSection(text, section);
    return {
      text: isolated ?? text.slice(0, 4000),
      sourceUrl,
      fetchedAt: new Date(),
    };
  }
}
