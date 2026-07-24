import { selectUser, useAppSelector } from '@org/store';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * Gates every `/config/*` (and legacy `/admin/*`) route to `role === 'admin'`.
 * Always nested inside `ProtectedRoute`, so `user` is guaranteed to be
 * resolved (not idle/pending) by the time this renders — no loader needed
 * here, just the role check.
 */
export function AdminRoute() {
  const user = useAppSelector(selectUser);

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default AdminRoute;
