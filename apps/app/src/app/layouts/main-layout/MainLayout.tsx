import { useEffect, useState, type ReactNode } from 'react';
import {
  logoutThunk,
  selectUser,
  useAppDispatch,
  useAppSelector,
} from '@org/store';
import { Button, LanguageSwitcher, UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { useTranslation } from 'react-i18next';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { APP_ENV } from '../../../config';

/**
 * Authenticated app shell: a fixed left sidebar on md+ screens, and a
 * slide-in drawer behind a hamburger on mobile. Full-bleed tools (the
 * document editors) live outside this layout — see app.tsx.
 */
export function MainLayout() {
  const user = useAppSelector(selectUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const onLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-secondary/10">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
        <button
          type="button"
          aria-label={t('common.openMenu', 'Open menu')}
          onClick={() => setMobileOpen(true)}
          className="-ml-1 inline-flex size-9 items-center justify-center rounded-md text-foreground/70 hover:bg-secondary/60"
        >
          <MenuIcon />
        </button>
        <Link to="/dashboard" className="text-base font-semibold">
          {APP_ENV.appName}
        </Link>
        <div className="ml-auto">
          <UserAvatar name={user?.name} src={user?.picture} size="sm" />
        </div>
      </header>

      {/* Sidebar (drawer on mobile, fixed on desktop) */}
      <Sidebar
        userName={user?.name}
        userEmail={user?.email}
        userPicture={user?.picture}
        isAdmin={user?.role === 'admin'}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onLogout={onLogout}
      />

      {/* Content */}
      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;

// ─── Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  userPicture?: string | null;
  isAdmin: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

function Sidebar({
  userName,
  userEmail,
  userPicture,
  isAdmin,
  mobileOpen,
  onClose,
  onLogout,
}: SidebarProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform duration-200 ease-out md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <LogoIcon />
          </span>
          <Link to="/dashboard" className="text-base font-semibold">
            {APP_ENV.appName}
          </Link>
        </div>

        {/* Primary CTA */}
        <div className="p-3">
          <Button asChild className="w-full justify-center gap-1.5">
            <Link to="/documents/new">
              <PlusIcon />
              {t('common.newDocument', 'New document')}
            </Link>
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          <NavItem
            to="/dashboard"
            label={t('nav.dashboard', 'Dashboard')}
            icon={<GridIcon />}
          />
          <NavItem
            to="/documents"
            label={t('nav.documents', 'Documents')}
            icon={<DocsIcon />}
          />
          <NavItem
            to="/analyze"
            label={t('nav.analyze', 'Analyze')}
            icon={<ScanIcon />}
          />
          <NavItem
            to="/batches"
            label={t('nav.batches', 'Batches')}
            icon={<LayersIcon />}
          />
          <NavItem
            to="/review-queue"
            label={t('nav.reviewQueue', 'Review queue')}
            icon={<InboxIcon />}
          />
          {/* Temporarily visible to all users (no admin gate). */}
          <NavItem
            to="/admin/intelligence"
            label={t('nav.docConfig', 'Doc config')}
            icon={<ShieldIcon />}
          />
          <NavItem
            to="/editor"
            label={t('nav.quickEditor', 'Quick editor')}
            icon={<PenIcon />}
          />
          <NavItem
            to="/settings"
            label={t('nav.settings', 'Settings')}
            icon={<GearIcon />}
          />
          {isAdmin && (
            <NavItem
              to="/admin"
              label={t('nav.admin', 'Admin')}
              icon={<ShieldIcon />}
            />
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="px-2 pb-2">
            <LanguageSwitcher className="w-full" />
          </div>
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <UserAvatar name={userName} src={userPicture} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {userName}
              </p>
              <p className="truncate text-xs text-foreground/55">{userEmail}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground/70 transition-colors hover:bg-error/10 hover:text-error"
          >
            <LogoutIcon />
            {t('common.logout', 'Log out')}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavItem({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-foreground/70 hover:bg-secondary/60 hover:text-foreground',
        )
      }
      end={to === '/documents'}
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      {label}
    </NavLink>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────

const iconProps = {
  className: 'size-[18px]',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function MenuIcon() {
  return (
    <svg {...iconProps} className="size-5">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
function LogoIcon() {
  return (
    <svg {...iconProps} className="size-4">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg {...iconProps} className="size-4">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function DocsIcon() {
  return (
    <svg {...iconProps}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg {...iconProps}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg {...iconProps}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}
function PenIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg {...iconProps} className="size-[18px]">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
