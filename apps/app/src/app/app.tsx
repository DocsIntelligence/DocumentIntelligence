import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  fetchMeThunk,
  selectAuthStatus,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { ProtectedRoute } from './components/protected-route/ProtectedRoute';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { AiUsagePage } from './features/admin/ai-usage/AiUsagePage';
import { AdminSettingsPage } from './features/admin/settings/AdminSettingsPage';
import {
  AdminLegalReferencePage,
  CloneCitationPage,
  EditCitationPage,
  NewCitationPage,
  ReformLookupPage,
} from './features/admin/legal-reference/AdminLegalReferencePage';
import {
  CloneDocTypePage,
  ClonePipelinePage,
  DocTypesPage,
  EditDocTypePage,
  EditLookupGroupPage,
  EditPipelinePage,
  EditVaultDocKindPage,
  EditVaultFieldPage,
  FieldMappingPage,
  LookupsPage,
  NewDocTypePage,
  NewLookupGroupPage,
  NewPipelinePage,
  NewVaultDocKindPage,
  NewVaultEntityKindPage,
  EditVaultEntityKindPage,
  NewVaultFieldPage,
  PipelinesPage,
  SearchConfigPage,
  VaultConfigPage,
  VaultDocKindsPage,
  VaultFieldsPage,
} from './features/admin/intelligence/IntelligenceConfigPage';
import { AuthCallback } from './features/auth/callback/AuthCallback';
import { ForgotPassword } from './features/auth/forgot-password/ForgotPassword';
import { Login } from './features/auth/login/Login';
import { Register } from './features/auth/register/Register';
import { ResetPassword } from './features/auth/reset-password/ResetPassword';
import { Dashboard } from './features/dashboard/Dashboard';
import {
  BuilderPage,
  DocumentsList,
  DraftWithAIPage,
  NewDocumentPicker,
  SharedDocumentView,
  TemplatesPage,
} from './features/documents';
import {
  EditorDemo,
  DraftEditorPage,
  MarkdownEditorPage,
  MarkdownDraftPage,
} from './features/editor';
import { GroupDetailPage } from './features/groups/GroupDetailPage';
import { GroupsPage } from './features/groups/GroupsPage';
import { GroupAddDocsPage } from './features/groups/GroupAddDocsPage';
import {
  AnalyzePage,
  BatchDetailPage,
  BatchesPage,
  IntelligenceUpload,
  NewBatchPage,
  ReviewQueuePage,
} from './features/intelligence';
import { SearchPage } from './features/search';
import {
  EstateHomePage,
  EstateAssetsPage,
  EstateAssetNewPage,
  EstateImportPage,
  EstateBulkImportPage,
  EstateAssetDetailPage,
  EstateSearchPage,
  EstateLayout,
  EstateProfilesPage,
  NomineesPage,
  EstateReleasePage,
  EstateReportPage,
  NomineeAccessPage,
} from './features/estate';
import {
  VaultPage,
  VaultEntityPage,
  VaultEntityEditPage,
  VaultNewEntityPage,
} from './features/vault';
import { EstateVaultConfigPage } from './features/admin/estate/EstateVaultConfigPage';
import { EstateGrantsPage } from './features/admin/estate/EstateGrantsPage';
import { Settings } from './features/settings/Settings';
import { AuthLayout } from './layouts/auth-layout/AuthLayout';
import { MainLayout } from './layouts/main-layout/MainLayout';

export function App() {
  const dispatch = useAppDispatch();
  const status = useAppSelector(selectAuthStatus);
  const attempted = useRef(false);

  // Try to fetch user once on mount (cookie sent automatically).
  // If it fails (no cookie / expired), we just stay on auth pages.
  useEffect(() => {
    if (!attempted.current && status === 'idle') {
      attempted.current = true;
      void dispatch(fetchMeThunk());
    }
  }, [dispatch, status]);

  return (
    <Routes>
      {/* Public, no-auth: shared document view.
       *
       * /law and /law/:id are served by apps/web (Next.js SSR) for SEO +
       * OG previews + JSON-LD. The SPA never renders them — any in-app link
       * to a citation page is an absolute URL pointing at the marketing
       * domain.
       */}
      <Route path="/s/:token" element={<SharedDocumentView />} />
      {/* Public, token-guarded nominee access (resolves only once released). */}
      <Route path="/n/:token" element={<NomineeAccessPage />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/vault/new" element={<VaultNewEntityPage />} />
        <Route path="/vault/:id" element={<VaultEntityPage />} />
        <Route path="/vault/:id/edit" element={<VaultEntityEditPage />} />
        {/* All in-app estate routes share the profile switcher + active-profile
         *  context (docs/15). The public /n/:token nominee view stays outside. */}
        <Route element={<EstateLayout />}>
          <Route path="/estate" element={<EstateHomePage />} />
          <Route path="/estate/search" element={<EstateSearchPage />} />
          <Route path="/estate/assets" element={<EstateAssetsPage />} />
          <Route path="/estate/assets/new" element={<EstateAssetNewPage />} />
          <Route path="/estate/import" element={<EstateImportPage />} />
          <Route
            path="/estate/import-files"
            element={<EstateBulkImportPage />}
          />
          <Route path="/estate/assets/:id" element={<EstateAssetDetailPage />} />
          <Route path="/estate/profiles" element={<EstateProfilesPage />} />
          <Route path="/estate/nominees" element={<NomineesPage />} />
          <Route path="/estate/release" element={<EstateReleasePage />} />
          <Route path="/estate/report" element={<EstateReportPage />} />
        </Route>
        <Route path="/documents" element={<DocumentsList />} />
        <Route path="/documents/new" element={<NewDocumentPicker />} />
        <Route path="/documents/templates" element={<TemplatesPage />} />
        <Route path="/documents/draft-ai" element={<DraftWithAIPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />
        <Route path="/groups/:id/add" element={<GroupAddDocsPage />} />
        <Route path="/analyze" element={<IntelligenceUpload />} />
        <Route path="/analyze/:sourceId" element={<AnalyzePage />} />
        <Route path="/batches" element={<BatchesPage />} />
        <Route path="/batches/new" element={<NewBatchPage />} />
        <Route path="/batches/:id" element={<BatchDetailPage />} />
        <Route path="/review-queue" element={<ReviewQueuePage />} />
        <Route path="/settings" element={<Settings />} />

        {/*
         * Config (app-wide configuration) — was split between /admin/* and
         * /admin/intelligence/*. Everything now lives under a flat /config/*
         * namespace. Legacy /admin/* paths redirect via the wildcard below.
         */}
        <Route path="/config" element={<AdminDashboard />} />
        <Route path="/config/ai-usage" element={<AiUsagePage />} />
        <Route path="/config/settings" element={<AdminSettingsPage />} />
        <Route
          path="/config/legal-reference"
          element={<AdminLegalReferencePage />}
        />
        <Route
          path="/config/legal-reference/reform"
          element={<ReformLookupPage />}
        />
        <Route
          path="/config/legal-reference/new"
          element={<NewCitationPage />}
        />
        <Route
          path="/config/legal-reference/:id/edit"
          element={<EditCitationPage />}
        />
        <Route
          path="/config/legal-reference/:id/clone"
          element={<CloneCitationPage />}
        />
        <Route path="/config/document-types" element={<DocTypesPage />} />
        <Route
          path="/config/document-types/new"
          element={<NewDocTypePage />}
        />
        <Route
          path="/config/document-types/:schemaKey/edit"
          element={<EditDocTypePage />}
        />
        <Route
          path="/config/document-types/:schemaKey/clone"
          element={<CloneDocTypePage />}
        />
        <Route
          path="/config/document-types/:schemaKey/mapping"
          element={<FieldMappingPage />}
        />
        <Route path="/config/pipelines" element={<PipelinesPage />} />
        <Route path="/config/pipelines/new" element={<NewPipelinePage />} />
        <Route
          path="/config/pipelines/:pipelineKey/edit"
          element={<EditPipelinePage />}
        />
        <Route
          path="/config/pipelines/:pipelineKey/clone"
          element={<ClonePipelinePage />}
        />
        <Route path="/config/lookups" element={<LookupsPage />} />
        <Route
          path="/config/lookups/new"
          element={<NewLookupGroupPage />}
        />
        <Route
          path="/config/lookups/:groupId"
          element={<EditLookupGroupPage />}
        />
        <Route path="/config/search" element={<SearchConfigPage />} />
        <Route path="/config/vault" element={<VaultConfigPage />} />
        <Route
          path="/config/vault/entity-kinds/new"
          element={<NewVaultEntityKindPage />}
        />
        <Route
          path="/config/vault/entity-kinds/:kindId/edit"
          element={<EditVaultEntityKindPage />}
        />
        <Route path="/config/vault/fields" element={<VaultFieldsPage />} />
        <Route
          path="/config/vault/fields/new"
          element={<NewVaultFieldPage />}
        />
        <Route
          path="/config/vault/fields/:fieldId/edit"
          element={<EditVaultFieldPage />}
        />
        <Route
          path="/config/vault/doc-kinds"
          element={<VaultDocKindsPage />}
        />
        <Route
          path="/config/vault/doc-kinds/new"
          element={<NewVaultDocKindPage />}
        />
        <Route
          path="/config/vault/doc-kinds/:kindId/edit"
          element={<EditVaultDocKindPage />}
        />
        <Route
          path="/config/estate-vault"
          element={<EstateVaultConfigPage />}
        />
        <Route
          path="/config/estate-vault/grants"
          element={<EstateGrantsPage />}
        />

        {/* Back-compat: redirect any /admin/* bookmark to its /config/*
         *  equivalent. The "intelligence" middle segment is dropped, and the
         *  former "intelligence/types" becomes "document-types". */}
        <Route path="/admin/*" element={<AdminLegacyRedirect />} />
      </Route>

      {/* Editors run full-bleed (no app shell) for max working area. */}
      <Route
        path="/editor"
        element={
          <ProtectedRoute>
            <EditorDemo />
          </ProtectedRoute>
        }
      />
      <Route
        path="/editor/markdown"
        element={
          <ProtectedRoute>
            <MarkdownEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/:id/markdown"
        element={
          <ProtectedRoute>
            <MarkdownDraftPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/:id/draft"
        element={
          <ProtectedRoute>
            <DraftEditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/:id/edit"
        element={
          <ProtectedRoute>
            <BuilderPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;

/**
 * Map any /admin/* path to its /config/* equivalent. Handles bookmarks from
 * the previous route layout where intelligence-flavoured config lived under
 * /admin/intelligence/* and the rest under /admin/*. Pure derivation — no
 * server roundtrip; falls back to /config (the dashboard) for unknown shapes.
 */
function AdminLegacyRedirect() {
  const loc = useLocation();
  const target = mapAdminToConfig(loc.pathname) + loc.search + loc.hash;
  return <Navigate to={target} replace />;
}

function mapAdminToConfig(pathname: string): string {
  // Strip leading "/admin", then map the known sub-prefixes. Order matters —
  // longer prefixes first so we never partially match.
  let rest = pathname.replace(/^\/admin/, '');
  if (rest === '' || rest === '/') return '/config';

  const mappings: Array<[RegExp, string]> = [
    [/^\/intelligence\/types(\b|$)/, '/document-types'],
    [/^\/intelligence\/pipelines(\b|$)/, '/pipelines'],
    [/^\/intelligence\/lookups(\b|$)/, '/lookups'],
    [/^\/intelligence\/search(\b|$)/, '/search'],
    [/^\/intelligence\/vault(\b|$)/, '/vault'],
    [/^\/intelligence(\b|$)/, '/document-types'], // bare /admin/intelligence
    [/^\/legal-reference(\b|$)/, '/legal-reference'],
    [/^\/ai-usage(\b|$)/, '/ai-usage'],
    [/^\/settings(\b|$)/, '/settings'],
  ];
  for (const [pattern, replacement] of mappings) {
    if (pattern.test(rest)) {
      rest = rest.replace(pattern, replacement);
      return '/config' + rest;
    }
  }
  return '/config';
}
