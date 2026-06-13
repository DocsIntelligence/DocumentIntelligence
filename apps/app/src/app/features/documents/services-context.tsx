import type {
  DocumentsService,
  IntelligenceAdminService,
  IntelligenceService,
  LegalAiService,
  LookupsService,
  SearchService,
  SharesService,
  VaultService,
} from '@org/api-client';
import { createContext, type ReactNode, useContext } from 'react';

/**
 * Tiny React context exposing the documents + legal-ai + intelligence HTTP
 * services to the feature folders. Created once in main.tsx so the same axios
 * instance (with refresh interceptors) is reused.
 */

interface Services {
  documents: DocumentsService;
  legalAi: LegalAiService;
  shares: SharesService;
  lookups: LookupsService;
  intelligence: IntelligenceService;
  intelligenceAdmin: IntelligenceAdminService;
  search: SearchService;
  vault: VaultService;
}

const ServicesContext = createContext<Services | null>(null);

interface ProviderProps extends Services {
  children: ReactNode;
}

export function ServicesProvider({
  documents,
  legalAi,
  shares,
  lookups,
  intelligence,
  intelligenceAdmin,
  search,
  vault,
  children,
}: ProviderProps) {
  return (
    <ServicesContext.Provider
      value={{
        documents,
        legalAi,
        shares,
        lookups,
        intelligence,
        intelligenceAdmin,
        search,
        vault,
      }}
    >
      {children}
    </ServicesContext.Provider>
  );
}

export function useDocumentsService(): DocumentsService {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useDocumentsService outside <ServicesProvider>');
  return ctx.documents;
}

export function useLegalAiService(): LegalAiService {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useLegalAiService outside <ServicesProvider>');
  return ctx.legalAi;
}

export function useSharesService(): SharesService {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useSharesService outside <ServicesProvider>');
  return ctx.shares;
}

export function useLookupsService(): LookupsService {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useLookupsService outside <ServicesProvider>');
  return ctx.lookups;
}

export function useIntelligenceService(): IntelligenceService {
  const ctx = useContext(ServicesContext);
  if (!ctx)
    throw new Error('useIntelligenceService outside <ServicesProvider>');
  return ctx.intelligence;
}

export function useIntelligenceAdminService(): IntelligenceAdminService {
  const ctx = useContext(ServicesContext);
  if (!ctx)
    throw new Error('useIntelligenceAdminService outside <ServicesProvider>');
  return ctx.intelligenceAdmin;
}

export function useSearchService(): SearchService {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useSearchService outside <ServicesProvider>');
  return ctx.search;
}

export function useVaultService(): VaultService {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useVaultService outside <ServicesProvider>');
  return ctx.vault;
}
