import {
  selectAuthStatus,
  selectIsAuthenticated,
  useAppSelector,
} from '@org/store';
import { PageLoader } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet } from 'react-router-dom';
import { Card } from '@org/ui';
import { APP_ENV } from '../../../config';

export function AuthLayout() {
  const { t } = useTranslation();
  const isAuth = useAppSelector(selectIsAuthenticated);
  const status = useAppSelector(selectAuthStatus);

  // Wait for the initial auth check to complete
  if (status === 'pending') {
    return <PageLoader />;
  }

  // Already logged in — skip auth pages, go to dashboard
  if (isAuth) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{APP_ENV.appName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('auth.layout.welcome', 'Welcome back')}
          </p>
        </div>
        <Card className="rounded-xl p-8">
          <Outlet />
        </Card>
      </div>
    </div>
  );
}

export default AuthLayout;
