import './i18n';
// Self-hosted document fonts — bundled (not system/Google-hosted) so the live
// preview here and the Puppeteer-rendered PDF (apps/artboard) measure and paint
// Hindi + Latin with byte-identical faces, and pagination breaks at the same
// places. Keep weights in sync with apps/artboard/src/main.tsx and the
// DOC_FONT_SPECS list in @org/document-templates' use-fonts-ready.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/noto-sans-devanagari/400.css';
import '@fontsource/noto-sans-devanagari/500.css';
import '@fontsource/noto-sans-devanagari/600.css';
import '@fontsource/noto-sans-devanagari/700.css';
import {
  createAuthService,
  createDocumentsService,
  createHttpClient,
  createIntelligenceService,
  createIntelligenceAdminService,
  createLegalAiService,
  createLookupsService,
  createSharesService,
  createUsersService,
} from '@org/api-client';
import { authActions, configureAppStore } from '@org/store';
import { TooltipProvider } from '@org/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './app/app';
import { ConfirmProvider } from './app/components/confirm/ConfirmProvider';
import { PromptProvider } from './app/components/confirm/PromptProvider';
import { ServicesProvider } from './app/features/documents/services-context';
import { APP_ENV } from './config';
import './styles.css';

const API_BASE_URL = APP_ENV.apiUrl;

// Separate client for refresh — no interceptors to avoid loops
const httpForRefresh = createHttpClient({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
const authForRefresh = createAuthService(httpForRefresh);

// Main HTTP client with refresh interceptor
const http = createHttpClient({
  baseURL: API_BASE_URL,
  withCredentials: true,
  refreshAccessToken: async () => {
    try {
      const result = await authForRefresh.refresh({});
      store.dispatch(authActions.setUser(result.user));
      return result.accessToken;
    } catch {
      store.dispatch(authActions.clearAuth());
      return null;
    }
  },
  onUnauthorized: () => {
    store.dispatch(authActions.clearAuth());
  },
});

const auth = createAuthService(http);
const users = createUsersService(http);
const documents = createDocumentsService(http);
const legalAi = createLegalAiService(http);
const shares = createSharesService(http);
const lookups = createLookupsService(http);
const intelligence = createIntelligenceService(http);
const intelligenceAdmin = createIntelligenceAdminService(http);

const store = configureAppStore({ services: { auth, users } });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// Keep the browser tab title in sync with the env-driven app name so a
// rename only needs VITE_APP_NAME, not a parallel edit to index.html.
document.title = APP_ENV.appName;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <Provider store={store}>
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ServicesProvider
            documents={documents}
            legalAi={legalAi}
            shares={shares}
            lookups={lookups}
            intelligence={intelligence}
            intelligenceAdmin={intelligenceAdmin}
          >
            <BrowserRouter>
              <ConfirmProvider>
                <PromptProvider>
                  <App />
                  <Toaster richColors position="bottom-right" />
                </PromptProvider>
              </ConfirmProvider>
            </BrowserRouter>
          </ServicesProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </StrictMode>
  </Provider>,
);
