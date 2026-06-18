import { Injectable } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer-core';
import { errorMessage } from './error.util';

/**
 * Acquires a headless Chrome instance for server-side rendering (PDF/screenshot).
 * Two modes, in priority order:
 *   1. Remote (Browserless / chrome-headless-shell over WS) — when CHROME_URL set.
 *      `connect` + `disconnect` (don't shut down a shared instance).
 *   2. Local — PUPPETEER_EXECUTABLE_PATH points at a Chromium binary.
 *
 * Env: CHROME_URL, CHROME_TOKEN, CHROME_IGNORE_HTTPS_ERRORS,
 *      PUPPETEER_EXECUTABLE_PATH, PUPPETEER_LAUNCH_ARGS.
 *
 * NOTE: `documents/exports/pdf-renderer.service.ts` still has an equivalent
 * private copy (it predates this); consolidate onto this service when touched.
 */
@Injectable()
export class HeadlessBrowserService {
  async acquire(): Promise<{ browser: Browser; dispose: () => Promise<void> }> {
    const chromeUrl = process.env.CHROME_URL;
    if (chromeUrl) {
      const token = process.env.CHROME_TOKEN;
      const endpoint = token
        ? `${chromeUrl}${chromeUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : chromeUrl;
      let browser: Browser;
      try {
        browser = await puppeteer.connect({
          browserWSEndpoint: endpoint,
          acceptInsecureCerts: process.env.CHROME_IGNORE_HTTPS_ERRORS === 'true',
        });
      } catch (e) {
        throw new Error(
          `Could not connect to headless browser at ${chromeUrl} — is the Browserless/Chrome endpoint (CHROME_URL) running and reachable? (${errorMessage(e)})`,
        );
      }
      return { browser, dispose: () => browser.disconnect() };
    }

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      throw new Error(
        'Neither CHROME_URL (Browserless WS endpoint) nor PUPPETEER_EXECUTABLE_PATH (local Chromium binary) is set.',
      );
    }
    let browser: Browser;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          ...parseLaunchArgs(process.env.PUPPETEER_LAUNCH_ARGS),
        ],
      });
    } catch (e) {
      throw new Error(
        `Could not launch local Chromium at ${executablePath} (PUPPETEER_EXECUTABLE_PATH) — is the binary present? (${errorMessage(e)})`,
      );
    }
    return { browser, dispose: () => browser.close() };
  }
}

function parseLaunchArgs(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
      return parsed;
    }
  } catch {
    // ignore — fall through to raw split
  }
  return raw
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
}
