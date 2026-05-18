import { useState, useRef, useEffect } from 'react';
import {
  logoutThunk,
  selectUser,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { UserAvatar } from '@org/ui';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { APP_ENV } from '../../../config';

export function MainLayout() {
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const onLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/dashboard"
            className="text-lg font-semibold text-foreground"
          >
            {APP_ENV.appName}
          </Link>

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
            >
              <UserAvatar name={user?.name} size="sm" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-background shadow-lg py-1 z-50">
                {/* User info */}
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-foreground/60 truncate">
                    {user?.email}
                  </p>
                </div>

                {/* Links */}
                <div className="py-1">
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/documents"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    Documents
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    Settings
                  </Link>
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                </div>

                {/* Logout */}
                <div className="border-t border-border/50 py-1">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-error hover:bg-error/10 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
