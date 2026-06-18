import {
  getActiveEstateProfileId,
  setActiveEstateProfileId,
  type EstateProfile,
} from '@org/api-client';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useEstateProfiles, useUpdateProfile } from './queries';

/**
 * Active-profile context for the Estate / Wealth Vault module (docs/15).
 *
 * One account can manage several person-vaults (self, spouse, a wealth
 * manager's clients). Every profile-scoped `/estate/*` request is tagged with
 * the active profile id by an axios interceptor (see api-client
 * `installEstateProfileParam`); this provider owns *which* profile is active,
 * persists it across reloads, and — crucially — clears the profile-scoped React
 * Query cache on every switch so no other profile's data is shown from cache.
 *
 * The query keys deliberately do NOT encode the profile id (keeping the data
 * hooks profileId-free); correctness comes from `removeQueries(['estate'])` on
 * switch instead.
 */

const STORAGE_KEY = 'estate.activeProfileId';

interface ActiveProfileContextValue {
  profiles: EstateProfile[];
  activeProfileId: string | null;
  activeProfile: EstateProfile | null;
  setActiveProfile: (id: string) => void;
  /** Active profile's privacy default: mask monetary amounts on screen. */
  maskAmounts: boolean;
  /** Flip the active profile's amount-masking (persisted to the DB). */
  toggleMaskAmounts: () => void;
  isLoading: boolean;
}

const ActiveProfileContext = createContext<ActiveProfileContextValue | null>(
  null,
);

export function EstateProfileProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: profiles, isLoading } = useEstateProfiles();
  const updateProfile = useUpdateProfile();
  const list = useMemo(() => profiles ?? [], [profiles]);

  // Seed from localStorage synchronously so the very first profile-scoped
  // request in the session is already tagged (the api-client module-level
  // `activeEstateProfileId` is what the interceptor reads).
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    () => {
      const stored =
        typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) setActiveEstateProfileId(stored);
      return stored;
    },
  );

  const applyActive = useCallback((id: string) => {
    setActiveEstateProfileId(id);
    localStorage.setItem(STORAGE_KEY, id);
    setActiveProfileIdState(id);
  }, []);

  // Once profiles load, make sure the active id is one we actually have access
  // to; otherwise fall back to the self profile (or the first available).
  useEffect(() => {
    if (!list.length) return;
    const valid =
      activeProfileId && list.some((p) => p.id === activeProfileId);
    if (!valid) {
      const fallback = list.find((p) => p.isSelf) ?? list[0];
      applyActive(fallback.id);
    } else if (getActiveEstateProfileId() !== activeProfileId) {
      // Keep the api-client module in sync if it drifted (e.g. after a reload
      // where the seed set it but a later state change didn't go through here).
      setActiveEstateProfileId(activeProfileId);
    }
  }, [list, activeProfileId, applyActive]);

  const setActiveProfile = useCallback(
    (id: string) => {
      if (id === activeProfileId) return;
      applyActive(id);
      // Refresh every profile-scoped estate query for the new profile. The keys
      // don't carry the profile id, so on switch we `resetQueries` the whole
      // `['estate']` tree: this clears the previous profile's cached data (no
      // stale flash) AND immediately refetches all mounted queries, so the page
      // reloads scoped to the newly-active profile. (The `['estate-profiles']`
      // tree — the profile list + access rows — is deliberately a sibling key,
      // so it survives this reset.)
      void qc.resetQueries({ queryKey: ['estate'] });
    },
    [activeProfileId, applyActive, qc],
  );

  const activeProfile = useMemo(
    () => list.find((p) => p.id === activeProfileId) ?? null,
    [list, activeProfileId],
  );

  const toggleMaskAmounts = useCallback(() => {
    if (!activeProfile) return;
    updateProfile.mutate({
      id: activeProfile.id,
      patch: { maskAmounts: !activeProfile.maskAmounts },
    });
  }, [activeProfile, updateProfile]);

  const value = useMemo<ActiveProfileContextValue>(
    () => ({
      profiles: list,
      activeProfileId,
      activeProfile,
      setActiveProfile,
      // Default to masked until profiles load, matching the DB default.
      maskAmounts: activeProfile?.maskAmounts ?? true,
      toggleMaskAmounts,
      isLoading,
    }),
    [list, activeProfileId, activeProfile, setActiveProfile, toggleMaskAmounts, isLoading],
  );

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export function useActiveProfile(): ActiveProfileContextValue {
  const ctx = useContext(ActiveProfileContext);
  if (!ctx) {
    throw new Error('useActiveProfile must be used within EstateProfileProvider');
  }
  return ctx;
}
