/**
 * Pluggable headless-browser fetcher — used as a FALLBACK after plain `fetch`
 * when the source's HTML is incomplete (SPA, anti-bot challenge, lazy-loaded
 * content, served as a JS-built iframe).
 *
 * Architecture matches `docs/ARCHITECTURE_PRINCIPLES.md` §"interface →
 * registry → factory → config-driven selection": every external/provider seam
 * goes through an interface so we can swap Browserless ↔ self-hosted
 * Puppeteer ↔ ScrapingBee without touching `IndiaCodeSourceAdapter`.
 */

export interface HeadlessFetchResult {
  /** Fully-rendered HTML (post-JS, with all hydrated content). */
  html: string;
  /** Final URL after any client-side redirects. */
  finalUrl: string;
  /** HTTP status from the underlying request. */
  status: number;
  /** Wall-clock duration (ms). */
  durationMs: number;
}

export interface HeadlessFetcher {
  /** Stable name for logs + admin diagnostics ('browserless', 'puppeteer'). */
  readonly name: string;
  /** True only when the adapter has the credentials / binary it needs to
   *  actually run. The registry skips disabled adapters. */
  isAvailable(): boolean;
  /** Render `url` in a headless browser and return the fully-rendered HTML.
   *
   *  `waitForSelector` (when set) tells the browser "the page is ready when
   *  this selector exists" — useful for SPA-style portals that hydrate the
   *  bare-act text after a brief delay. Most adapters fall back to a fixed
   *  `waitUntil: 'networkidle'` when the selector isn't provided. */
  fetch(opts: {
    url: string;
    waitForSelector?: string;
    timeoutMs?: number;
    userAgent?: string;
  }): Promise<HeadlessFetchResult>;
}
