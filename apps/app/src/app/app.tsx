import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
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
  NewVaultFieldPage,
  PipelinesPage,
  SearchConfigPage,
  VaultConfigPage,
  VaultDocKindsPage,
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
import { EditorDemo, DraftEditorPage } from './features/editor';
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
  VaultPage,
  VaultEntityPage,
  VaultEntityEditPage,
  VaultNewEntityPage,
} from './features/vault';
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
        <Route path="/documents" element={<DocumentsList />} />
        <Route path="/documents/new" element={<NewDocumentPicker />} />
        <Route path="/documents/templates" element={<TemplatesPage />} />
        <Route path="/documents/draft-ai" element={<DraftWithAIPage />} />
        <Route path="/analyze" element={<IntelligenceUpload />} />
        <Route path="/analyze/:sourceId" element={<AnalyzePage />} />
        <Route path="/batches" element={<BatchesPage />} />
        <Route path="/batches/new" element={<NewBatchPage />} />
        <Route path="/batches/:id" element={<BatchDetailPage />} />
        <Route path="/review-queue" element={<ReviewQueuePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/ai-usage" element={<AiUsagePage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin/legal-reference" element={<AdminLegalReferencePage />} />
        <Route path="/admin/legal-reference/new" element={<NewCitationPage />} />
        <Route path="/admin/legal-reference/:id/edit" element={<EditCitationPage />} />
        <Route path="/admin/legal-reference/:id/clone" element={<CloneCitationPage />} />
        <Route
          path="/admin/intelligence"
          element={<Navigate to="/admin/intelligence/types" replace />}
        />
        <Route path="/admin/intelligence/types" element={<DocTypesPage />} />
        <Route
          path="/admin/intelligence/types/new"
          element={<NewDocTypePage />}
        />
        <Route
          path="/admin/intelligence/types/:schemaKey/edit"
          element={<EditDocTypePage />}
        />
        <Route
          path="/admin/intelligence/types/:schemaKey/clone"
          element={<CloneDocTypePage />}
        />
        <Route
          path="/admin/intelligence/types/:schemaKey/mapping"
          element={<FieldMappingPage />}
        />
        <Route
          path="/admin/intelligence/pipelines"
          element={<PipelinesPage />}
        />
        <Route
          path="/admin/intelligence/pipelines/new"
          element={<NewPipelinePage />}
        />
        <Route
          path="/admin/intelligence/pipelines/:pipelineKey/edit"
          element={<EditPipelinePage />}
        />
        <Route
          path="/admin/intelligence/pipelines/:pipelineKey/clone"
          element={<ClonePipelinePage />}
        />
        <Route
          path="/admin/intelligence/lookups"
          element={<LookupsPage />}
        />
        <Route
          path="/admin/intelligence/lookups/new"
          element={<NewLookupGroupPage />}
        />
        <Route
          path="/admin/intelligence/lookups/:groupId"
          element={<EditLookupGroupPage />}
        />
        <Route
          path="/admin/intelligence/search"
          element={<SearchConfigPage />}
        />
        <Route
          path="/admin/intelligence/vault"
          element={<VaultConfigPage />}
        />
        <Route
          path="/admin/intelligence/vault/fields/new"
          element={<NewVaultFieldPage />}
        />
        <Route
          path="/admin/intelligence/vault/fields/:fieldId/edit"
          element={<EditVaultFieldPage />}
        />
        <Route
          path="/admin/intelligence/vault/doc-kinds"
          element={<VaultDocKindsPage />}
        />
        <Route
          path="/admin/intelligence/vault/doc-kinds/new"
          element={<NewVaultDocKindPage />}
        />
        <Route
          path="/admin/intelligence/vault/doc-kinds/:kindId/edit"
          element={<EditVaultDocKindPage />}
        />
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
