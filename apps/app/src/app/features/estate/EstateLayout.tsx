import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@org/ui';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { PageHeaderSlotContext } from '../../components/page-header';
import { EstateProfileProvider, useActiveProfile } from './profile-context';

/**
 * Layout wrapper for every `/estate/*` route (docs/15). Mounts the active-profile
 * provider and feeds a single compact profile menu into each page's header via
 * the PageHeader slot — so the controls live in the page header itself rather
 * than a separate bar above it.
 */
export function EstateLayout() {
  return (
    <EstateProfileProvider>
      <EstateHeaderControls>
        <Outlet />
      </EstateHeaderControls>
    </EstateProfileProvider>
  );
}

/** Provides the estate profile controls to the PageHeader slot for the subtree. */
function EstateHeaderControls({ children }: { children: React.ReactNode }) {
  return (
    <PageHeaderSlotContext.Provider value={<ProfileControls />}>
      {children}
    </PageHeaderSlotContext.Provider>
  );
}

/**
 * One control for the whole estate context: switch the active profile, toggle
 * amount masking, and jump to profile management — all under a single menu.
 * Icon-only on mobile; shows the active profile name from `sm` up.
 */
function ProfileControls() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    profiles,
    activeProfileId,
    setActiveProfile,
    maskAmounts,
    toggleMaskAmounts,
  } = useActiveProfile();

  // Nothing useful until the (auto-created) self profile has loaded.
  if (profiles.length === 0) return null;

  const active = profiles.find((p) => p.id === activeProfileId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          aria-label={t('estate.profileMenu', 'Profile & display options')}
        >
          <UsersIcon />
          <span className="hidden max-w-[10rem] truncate sm:inline">
            {active?.label ?? t('estate.selectProfile', 'Select a profile…')}
          </span>
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t('estate.profile', 'Profile')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={activeProfileId ?? undefined}
          onValueChange={setActiveProfile}
        >
          {profiles.map((p) => (
            <DropdownMenuRadioItem key={p.id} value={p.id}>
              <span className="flex flex-1 items-center gap-2">
                <span className="truncate">{p.label}</span>
                {p.isSelf ? (
                  <Badge variant="secondary" outline className="text-[10px]">
                    {t('estate.you', 'You')}
                  </Badge>
                ) : (
                  p.role !== 'owner' && (
                    <Badge variant="secondary" outline className="text-[10px]">
                      {p.role}
                    </Badge>
                  )
                )}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={!maskAmounts}
          onCheckedChange={() => toggleMaskAmounts()}
        >
          {t('estate.showAmounts', 'Show amounts')}
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/estate/profiles')}>
          {t('estate.manageProfiles', 'Manage profiles')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UsersIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="size-4 text-foreground/50"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
