import { Injectable } from '@nestjs/common';
import { IndiaCodeSourceAdapter } from './indiacode.adapter';
import type { LegalSourceAdapter } from './legal-source.interface';

/**
 * Resolves the right `LegalSourceAdapter` for a jurisdiction. One adapter
 * today (India). Adding UK/US later = one new adapter class + register() call;
 * consumers (`CitationSyncService`, admin UI) keep using `forJurisdiction()`.
 */
@Injectable()
export class LegalSourceRegistry {
  private readonly adapters = new Map<string, LegalSourceAdapter>();

  constructor(india: IndiaCodeSourceAdapter) {
    this.register(india);
  }

  register(adapter: LegalSourceAdapter) {
    this.adapters.set(adapter.jurisdiction.toUpperCase(), adapter);
  }

  forJurisdiction(jurisdiction: string): LegalSourceAdapter | null {
    return this.adapters.get(jurisdiction.toUpperCase()) ?? null;
  }

  list(): LegalSourceAdapter[] {
    return Array.from(this.adapters.values());
  }
}
