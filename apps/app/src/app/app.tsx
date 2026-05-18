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
import { AuthCallback } from './features/auth/callback/AuthCallback';
import { ForgotPassword } from './features/auth/forgot-password/ForgotPassword';
import { Login } from './features/auth/login/Login';
import { Register } from './features/auth/register/Register';
import { ResetPassword } from './features/auth/reset-password/ResetPassword';
import { Dashboard } from './features/dashboard/Dashboard';
import {
  BuilderPage,
  DocumentsList,
  NewDocumentPicker,
} from './features/documents';
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
        <Route path="/documents" element={<DocumentsList />} />
        <Route path="/documents/new" element={<NewDocumentPicker />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      {/* Builder runs full-bleed (no MainLayout) for max preview width. */}
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
