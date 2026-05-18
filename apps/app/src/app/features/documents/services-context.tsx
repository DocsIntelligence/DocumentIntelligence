import type { DocumentsService, LegalAiService } from '@org/api-client';
import { createContext, type ReactNode, useContext } from 'react';

/**
 * Tiny React context exposing the documents + legal-ai HTTP services to
 * the feature folder. Created once in main.tsx so the same axios instance
 * (with refresh interceptors) is reused.
 */

interface Services {
  documents: DocumentsService;
  legalAi: LegalAiService;
}

const ServicesContext = createContext<Services | null>(null);

interface ProviderProps extends Services {
  children: ReactNode;
}

export function ServicesProvider({
  documents,
  legalAi,
  children,
}: ProviderProps) {
  return (
    <ServicesContext.Provider value={{ documents, legalAi }}>
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
