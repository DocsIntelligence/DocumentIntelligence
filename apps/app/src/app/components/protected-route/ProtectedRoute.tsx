import {
  selectAuthStatus,
  selectIsAuthenticated,
  useAppSelector,
} from '@org/store';
import { PageLoader } from '@org/ui';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { setRedirectTarget } from '../../features/auth/redirect-target';

export interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuth = useAppSelector(selectIsAuthenticated);
  const status = useAppSelector(selectAuthStatus);
  const location = useLocation();

  // While the initial auth check is in progress (idle = not yet attempted,
  // pending = request in flight), show a loader instead of redirecting.
  if (status === 'idle' || status === 'pending') {
    return <PageLoader />;
  }

  if (!isAuth) {
    // Persist the intended destination so OAuth round-trips and a fresh
    // tab after refresh both return the user here, not the dashboard.
    setRedirectTarget(location.pathname + location.search);
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children as React.ReactElement;
}

export default ProtectedRoute;
