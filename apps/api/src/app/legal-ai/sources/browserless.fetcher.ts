import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  HeadlessFetchResult,
  HeadlessFetcher,
} from './headless-fetcher.interface';

/**
 * Headless fetcher backed by browserless.io / a self-hosted Browserless
 * instance. Uses the `/content` endpoint — sends the URL, the service runs
 * a headless Chromium, and returns the post-JS HTML.
 *
 * Why it's the preferred default: no local Chromium needed (works fine in
 * tiny serverless / fly.io / cloud-run containers), TLS terminated by them,
 * standard token-in-query auth.
 *
 * Config:
 *   • `BROWSERLESS_URL`   — full base URL of the service. Defaults to
 *                           https://chrome.browserless.io.
 *   • `BROWSERLESS_TOKEN` — required. When unset, `isAvailable()` returns
 *                           false and the registry skips this adapter.
 */
@Injectable()
export class BrowserlessFetcher implements HeadlessFetcher {
  readonly name = 'browserless';
  private readonly baseUrl: string;
  private readonly token: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('BROWSERLESS_URL') ??
      'https://chrome.browserless.io'
    ).replace(/\/$/, '');
    this.token = this.config.get<string>('BROWSERLESS_TOKEN');
  }

  isAvailable(): boolean {
    return Boolean(this.token);
  }

  async fetch(opts: {
    url: string;
    waitForSelector?: string;
    timeoutMs?: number;
    userAgent?: string;
  }): Promise<HeadlessFetchResult> {
    if (!this.token) {
      throw new Error('Browserless not configured (BROWSERLESS_TOKEN missing).');
    }
    const started = Date.now();
    const body: Record<string, unknown> = {
      url: opts.url,
      gotoOptions: {
        waitUntil: opts.waitForSelector ? 'load' : 'networkidle2',
        timeout: opts.timeoutMs ?? 25_000,
      },
    };
    if (opts.waitForSelector) {
      body['waitFor'] = { selector: opts.waitForSelector };
    }
    if (opts.userAgent) body['userAgent'] = opts.userAgent;

    const endpoint = `${this.baseUrl}/content?token=${encodeURIComponent(this.token)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout((opts.timeoutMs ?? 25_000) + 5_000),
    });

    if (!res.ok) {
      throw new Error(
        `Browserless returned HTTP ${res.status}: ${await res.text()}`,
      );
    }
    const html = await res.text();
    return {
      html,
      finalUrl: opts.url,
      status: res.status,
      durationMs: Date.now() - started,
    };
  }
}
