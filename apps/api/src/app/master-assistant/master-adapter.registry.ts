import { BadRequestException, Injectable } from '@nestjs/common';
import { DocumentTypeMasterAdapter } from './adapters/document-type.adapter';
import { LegalReferenceMasterAdapter } from './adapters/legal-reference.adapter';
import { LookupMasterAdapter } from './adapters/lookup.adapter';
import type { MasterAdapter } from './master-adapter';

/**
 * Registry of master adapters (config-as-data seam, ARCHITECTURE_PRINCIPLES).
 * Adding a new AI-upsertable master = implement MasterAdapter + register it
 * here; the service + controller + UI panel are generic over the registry.
 */
@Injectable()
export class MasterAdapterRegistry {
  private readonly byKey = new Map<string, MasterAdapter>();

  constructor(
    lookup: LookupMasterAdapter,
    documentType: DocumentTypeMasterAdapter,
    legalReference: LegalReferenceMasterAdapter,
  ) {
    for (const adapter of [lookup, documentType, legalReference]) {
      this.byKey.set(adapter.key, adapter);
    }
  }

  /** Summaries for the master selector. */
  list() {
    return [...this.byKey.values()].map((a) => ({
      key: a.key,
      label: a.label,
      description: a.description,
    }));
  }

  get(key: string): MasterAdapter {
    const adapter = this.byKey.get(key);
    if (!adapter) {
      throw new BadRequestException(`Unknown master "${key}".`);
    }
    return adapter;
  }
}
