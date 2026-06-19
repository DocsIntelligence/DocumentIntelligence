/**
 * Per-jurisdiction source adapter — strategy interface so we can plug
 * country-specific catalogs (India's indiacode.nic.in, UK's legislation.gov.uk,
 * US Code via uscode.house.gov) without touching the consumers
 * (CitationFiller / CitationAnalyzer / admin UI).
 *
 * Today: only `IndiaCodeSourceAdapter` is implemented. The registry resolves
 * by `jurisdiction` so adding another country is just a new adapter + a
 * registry entry.
 */

export interface FetchedStatuteSection {
  /** Bare-act text (or best-effort plain text from the source's HTML). */
  text: string;
  /** Canonical URL the text was pulled from — kept on `LegalCitation.externalUrl`. */
  sourceUrl: string;
  /** When this fetch happened (UTC). */
  fetchedAt: Date;
}

export interface LegalSourceAdapter {
  /** Two-letter ISO code: 'IN', 'GB', 'US', … */
  readonly jurisdiction: string;
  /** Human-readable source label for the admin UI ("indiacode.nic.in"). */
  readonly name: string;

  /**
   * Best-effort fetch of a section's bare-act text given:
   *  • `act`      — short act name as stored on the citation (e.g. "NI Act",
   *                 "BNSS", "Constitution").
   *  • `section`  — section number string (e.g. "138", "223").
   *  • `knownUrl` — optional canonical URL the admin already pasted onto the
   *                 citation (`externalUrl`). When present and pointing at the
   *                 adapter's own source host, the adapter fetches it directly
   *                 instead of guessing a URL from the act name. This is what
   *                 makes "sync from link" honour the link.
   *
   * Returns `null` when the adapter can't resolve the act + section to a
   * URL (don't throw — the admin UI surfaces a "paste manually" fallback).
   */
  fetchSection(
    act: string,
    section: string,
    knownUrl?: string,
  ): Promise<FetchedStatuteSection | null>;
}
