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
import { ErrorBoundary } from '../../components/error-boundary';
import { LayoutContext } from './layout-context';
import { SearchCommandPalette, openSearchPalette } from '../../features/search';
import { useEstateCapability } from '../../features/estate';
import { ThemeToggle } from '../../theme/ThemeToggle';
import { PaletteSwitch } from '../../theme/PaletteSwitch';

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
  // Desktop-only sidebar collapse (mobile uses the drawer). Persisted so the
  // choice survives reloads; toggled from the page header's sidebar icon.
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      localStorage.getItem('nav.collapsed') === '1',
  );
  const toggleSidebar = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('nav.collapsed', next ? '1' : '0');
      return next;
    });

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const onLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login');
  };

  return (
    <LayoutContext.Provider
      value={{ sidebarCollapsed: collapsed, toggleSidebar }}
    >
      <div className="min-h-screen bg-secondary/50">
        {/* Global ⌘K quick search (mounted once) */}
        <SearchCommandPalette />

        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-sidebar text-sidebar-foreground px-4 md:hidden">
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
          mobileOpen={mobileOpen}
          collapsed={collapsed}
          onClose={() => setMobileOpen(false)}
          onToggleCollapse={toggleSidebar}
          onLogout={onLogout}
        />

        {/* Desktop fallback to reopen the sidebar (works even on pages that
          don't render a PageHeader with its own toggle). */}
        {collapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={t('nav.showSidebar', 'Show sidebar')}
            title={t('nav.showSidebar', 'Show sidebar')}
            className="fixed left-3 top-3 z-30 hidden size-9 items-center justify-center rounded-md border border-border bg-card text-foreground/70 shadow-sm transition hover:bg-secondary hover:text-foreground md:inline-flex"
          >
            <MenuIcon />
          </button>
        )}

        {/* Content — drops the sidebar gutter when the sidebar is collapsed. */}
        <div
          className={cn(
            'transition-[padding]',
            collapsed ? 'md:pl-0' : 'md:pl-64',
          )}
        >
          <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 md:px-8 md:py-10">
            {/* Route-level boundary: keyed by path so navigating away clears a
              page-local error automatically. */}
            <ErrorBoundary level="route" key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}

export default MainLayout;

// ─── Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
  userName?: string | null;
  userEmail?: string | null;
  userPicture?: string | null;
  mobileOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

function Sidebar({
  userName,
  userEmail,
  userPicture,
  mobileOpen,
  collapsed,
  onClose,
  onToggleCollapse,
  onLogout,
}: SidebarProps) {
  const { t } = useTranslation();
  const user = useAppSelector(selectUser);
  const estate = useEstateCapability();
  const estateOn = estate.data?.enabled === true;
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
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:-translate-x-full' : 'md:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-3 pl-5">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/50 text-primary">
            <LogoIcon />
          </span>
          <Link to="/dashboard" className="truncate text-base font-semibold">
            {APP_ENV.appName}
          </Link>
          {/* Desktop collapse — mobile uses the drawer/overlay to dismiss. */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t('nav.hideSidebar', 'Hide sidebar')}
            title={t('nav.hideSidebar', 'Hide sidebar')}
            className="ml-auto hidden size-8 flex-none items-center justify-center rounded-md text-foreground/55 transition hover:bg-secondary hover:text-foreground md:inline-flex"
          >
            <SidebarCollapseIcon />
          </button>
          {/* Mobile close */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            title={t('common.close', 'Close')}
            className="ml-auto inline-flex size-8 flex-none items-center justify-center rounded-md text-foreground/55 transition hover:bg-secondary hover:text-foreground md:hidden"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Quick search trigger (opens the ⌘K palette) */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={openSearchPalette}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/50"
          >
            <SearchIcon />
            <span className="flex-1 text-left">
              {t('search.title', 'Search')}…
            </span>
            <kbd className="rounded border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
          </button>
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
            to="/search"
            label={t('nav.search', 'Search')}
            icon={<SearchIcon />}
          />
          <NavItem
            to="/vault"
            label={t('nav.vault', 'Vault')}
            icon={<VaultIcon />}
          />

          <NavGroup
            label={t('nav.documents', 'Documents')}
            icon={<DocsIcon />}
            storageKey="nav.group.documents"
            childPaths={['/documents', '/groups']}
          >
            <NavItem
              to="/documents"
              end
              label={t('nav.myDocuments', 'Documents')}
              icon={<DocsIcon />}
            />
            <NavItem
              to="/groups"
              end
              label={t('nav.groups', 'Groups')}
              icon={<FolderIcon />}
            />
          </NavGroup>

          {/* Operational doc-intelligence work */}
          <NavGroup
            label={t('nav.docIntel', 'Document Intelligence')}
            icon={<LayersIcon />}
            storageKey="nav.group.docIntel"
            childPaths={['/analyze', '/batches', '/review-queue']}
          >
            <NavItem
              to="/analyze"
              end
              label={t('nav.analyze', 'Analyze')}
              icon={<ScanIcon />}
            />
            <NavItem
              to="/batches"
              end
              label={t('nav.batches', 'Batches')}
              icon={<LayersIcon />}
            />
            <NavItem
              to="/review-queue"
              label={t('nav.reviewQueue', 'Review queue')}
              icon={<InboxIcon />}
            />
          </NavGroup>

          {estateOn && (
            <NavGroup
              label={t('nav.estate', 'Wealth Vault')}
              icon={<ChartIcon />}
              storageKey="nav.group.estate"
              childPaths={['/estate']}
            >
              <NavItem
                to="/estate"
                end
                label={t('nav.estateOverview', 'Overview')}
                icon={<ChartIcon />}
              />
              <NavItem
                to="/estate/assets"
                end
                label={t('nav.estateAssets', 'Assets')}
                icon={<ListIcon />}
              />
              <NavItem
                to="/estate/import-files"
                label={t('nav.estateBulkImport', 'Bulk file import')}
                icon={<LayersIcon />}
              />
              <NavItem
                to="/estate/nominees"
                label={t('nav.estateNominees', 'Nominees')}
                icon={<ShieldIcon />}
              />
              <NavItem
                to="/estate/release"
                label={t('nav.estateRelease', 'Release plan')}
                icon={<GearIcon />}
              />
              <NavItem
                to="/estate/report"
                label={t('nav.estateReport', 'Estate report')}
                icon={<BookIcon />}
              />
            </NavGroup>
          )}

          {/* Configuration — catalogs + settings, all under /config/*.
           *  Admin-only: the routes are gated by `AdminRoute` (app.tsx); hide
           *  the nav entry too so non-admins never see a link that bounces
           *  them back to the dashboard. */}
          {user?.role === 'admin' && (
            <NavGroup
              label={t('nav.configuration', 'Configuration')}
              icon={<GearIcon />}
              storageKey="nav.group.config"
              childPaths={['/config']}
            >
              <NavItem
                to="/config/document-types"
                label={t('nav.docTypes', 'Document types')}
                icon={<DocsIcon />}
              />
              <NavItem
                to="/config/pipelines"
                label={t('nav.pipelines', 'Pipelines')}
                icon={<FlowIcon />}
              />
              <NavItem
                to="/config/lookups"
                label={t('nav.lookups', 'Lookups')}
                icon={<ListIcon />}
              />
              <NavItem
                to="/config/search"
                label={t('nav.searchSettings', 'Search settings')}
                icon={<SearchIcon />}
              />
              <NavItem
                to="/config/vault"
                label={t('nav.vaultConfig', 'Vault fields')}
                icon={<VaultIcon />}
              />
              {estateOn && (
                <NavItem
                  to="/config/estate-vault"
                  label={t('nav.estateConfig', 'Estate Vault')}
                  icon={<ChartIcon />}
                />
              )}
              <NavItem
                to="/config/legal-reference"
                label={t('nav.legalReference', 'Legal references')}
                icon={<BookIcon />}
              />
              <NavItem
                to="/config/ai-usage"
                label={t('nav.aiUsage', 'AI usage')}
                icon={<ChartIcon />}
              />
              <NavItem
                to="/config/settings"
                label={t('nav.platformSettings', 'Platform settings')}
                icon={<GearIcon />}
              />
            </NavGroup>
          )}

          <NavItem
            to="/settings"
            label={t('nav.settings', 'Settings')}
            icon={<GearIcon />}
          />
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2">
            <LanguageSwitcher className="flex-1" />
            <div className="flex items-center gap-1.5">
              <PaletteSwitch />
              <ThemeToggle />
            </div>
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
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground/70 transition-colors hover:bg-error/50 hover:text-error"
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
  end,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/50 text-primary'
            : 'text-foreground/70 hover:bg-secondary/60 hover:text-foreground',
        )
      }
      end={end ?? to === '/documents'}
    >
      <span className="flex size-5 items-center justify-center">{icon}</span>
      {label}
    </NavLink>
  );
}

/**
 * A collapsible nav section. Open state persists in localStorage; the group
 * auto-expands (and stays open) whenever the active route is one of its
 * children, so deep links always reveal their context.
 */
function NavGroup({
  label,
  icon,
  storageKey,
  childPaths,
  children,
}: {
  label: string;
  icon: ReactNode;
  storageKey: string;
  childPaths: string[];
  children: ReactNode;
}) {
  const location = useLocation();
  const hasActiveChild = childPaths.some((p) =>
    location.pathname.startsWith(p),
  );
  const [open, setOpen] = useState(() => {
    const stored =
      typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
    return stored == null ? true : stored === '1';
  });

  // Auto-expand on first visit to a child route, but respect explicit collapse.
  const [userCollapsed, setUserCollapsed] = useState(false);
  const expanded = userCollapsed ? false : open || hasActiveChild;

  // Reset userCollapsed when navigating away from child routes
  useEffect(() => {
    if (!hasActiveChild) setUserCollapsed(false);
  }, [hasActiveChild]);

  const toggle = () => {
    if (expanded) {
      setUserCollapsed(true);
      setOpen(false);
      localStorage.setItem(storageKey, '0');
    } else {
      setUserCollapsed(false);
      setOpen(true);
      localStorage.setItem(storageKey, '1');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          hasActiveChild
            ? 'text-foreground'
            : 'text-foreground/70 hover:bg-secondary/60 hover:text-foreground',
        )}
      >
        <span className="flex size-5 items-center justify-center">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <ChevronIcon
          className={cn(
            'size-4 transition-transform',
            expanded ? 'rotate-90' : 'rotate-0',
          )}
        />
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-border/70 pl-3 ml-[1.4rem]">
          {children}
        </div>
      )}
    </div>
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
function SidebarCollapseIcon() {
  return (
    <svg {...iconProps} className="size-5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 9-3 3 3 3" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg {...iconProps} className="size-5">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="12" y1="9" x2="12" y2="9.01" />
      <line x1="14.5" y1="13.5" x2="16" y2="15" />
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
function FlowIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="15" width="6" height="6" rx="1" />
      <path d="M9 6h6a3 3 0 0 1 3 3v6" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg {...iconProps}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg {...iconProps} className={className}>
      <path d="m9 6 6 6-6 6" />
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
function ChartIcon() {
  return (
    <svg {...iconProps}>
      <line x1="3" y1="20" x2="21" y2="20" />
      <rect x="6" y="10" width="3" height="9" />
      <rect x="11" y="6" width="3" height="13" />
      <rect x="16" y="13" width="3" height="6" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg {...iconProps}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function BookIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
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
