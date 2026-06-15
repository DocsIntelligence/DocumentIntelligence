import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  HeadlessFetchResult,
  HeadlessFetcher,
} from './headless-fetcher.interface';

/**
 * Headless fetcher backed by Puppeteer (the existing `puppeteer-core` dep).
 * Connects to a Chrome instance via WebSocket — either a remote browser
 * (`PUPPETEER_BROWSER_WS_URL`, e.g. another container, ngrok'd Chrome) or
 * skipped entirely when no URL is configured.
 *
 * We don't auto-launch a local Chrome on the server — `puppeteer-core`
 * needs an external binary, and the API process is small. Self-hosters who
 * want a local Chrome can set `PUPPETEER_BROWSER_WS_URL=ws://localhost:9222`
 * after `chrome --remote-debugging-port=9222`.
 *
 * Why we keep it: gives us a zero-cost alternative to Browserless for
 * self-hosters and CI runs. Standard pattern from
 * `docs/ARCHITECTURE_PRINCIPLES.md` §"observable fallbacks".
 */
@Injectable()
export class PuppeteerFetcher implements HeadlessFetcher {
  readonly name = 'puppeteer';
  private readonly browserWsUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.browserWsUrl = this.config.get<string>('PUPPETEER_BROWSER_WS_URL');
  }

  isAvailable(): boolean {
    return Boolean(this.browserWsUrl);
  }

  async fetch(opts: {
    url: string;
    waitForSelector?: string;
    timeoutMs?: number;
    userAgent?: string;
  }): Promise<HeadlessFetchResult> {
    if (!this.browserWsUrl) {
      throw new Error(
        'Puppeteer fetcher not configured (PUPPETEER_BROWSER_WS_URL missing).',
      );
    }
    // Dynamic import so the binary isn't probed at boot. If the user removes
    // the dep, this throws only on the first fallback call — not at startup.
    const { default: puppeteer } = await import('puppeteer-core');
    const started = Date.now();
    const browser = await puppeteer.connect({
      browserWSEndpoint: this.browserWsUrl,
    });
    try {
      const page = await browser.newPage();
      if (opts.userAgent) {
        // setUserAgent is the long-stable API; the deprecation warning points
        // at the newer setUserAgent({ userAgent, ... }) signature which
        // requires UA metadata we don't have. Keep the simple string form.
        await page.setExtraHTTPHeaders({ 'User-Agent': opts.userAgent });
      }
      const timeout = opts.timeoutMs ?? 25_000;
      const resp = await page.goto(opts.url, {
        waitUntil: opts.waitForSelector ? 'load' : 'networkidle2',
        timeout,
      });
      if (opts.waitForSelector) {
        await page.waitForSelector(opts.waitForSelector, { timeout });
      }
      const html = await page.content();
      const finalUrl = page.url();
      const status = resp?.status() ?? 0;
      await page.close();
      return { html, finalUrl, status, durationMs: Date.now() - started };
    } finally {
      // We connect (not launch), so disconnect — don't close the shared Chrome.
      await browser.disconnect();
    }
  }
}
