import { Injectable, Logger } from '@nestjs/common';
import { BrowserlessFetcher } from './browserless.fetcher';
import type { HeadlessFetcher } from './headless-fetcher.interface';
import { PuppeteerFetcher } from './puppeteer.fetcher';

/**
 * Picks the best-available headless fetcher at runtime. Priority order:
 *  1. Browserless  — hosted, zero local deps. Default when token is set.
 *  2. Puppeteer    — connects to an external Chrome WS URL.
 *  3. null         — no fallback; sync stays on plain `fetch` only.
 *
 * The registry is queried lazily (per call), so flipping an env var without a
 * restart is fine after a 30-second config-cache window — same pattern as
 * `LegalSourceRegistry`.
 */
@Injectable()
export class HeadlessFetcherRegistry {
  private readonly logger = new Logger(HeadlessFetcherRegistry.name);
  private readonly adapters: HeadlessFetcher[];

  constructor(
    browserless: BrowserlessFetcher,
    puppeteer: PuppeteerFetcher,
  ) {
    this.adapters = [browserless, puppeteer];
  }

  /** First available adapter, or `null` if none is configured. */
  pick(): HeadlessFetcher | null {
    return this.adapters.find((a) => a.isAvailable()) ?? null;
  }

  /** Names of every configured (available) adapter — admin diagnostics. */
  available(): string[] {
    return this.adapters.filter((a) => a.isAvailable()).map((a) => a.name);
  }
}
