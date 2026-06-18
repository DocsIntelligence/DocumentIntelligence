import type { AxiosInstance } from 'axios';

/**
 * The active Estate profile (person-vault) id, shared so the HTTP layer can
 * scope every `/estate/*` request to it without each call passing it. The app
 * sets this when the user switches profiles; React Query keys still clear on
 * switch so no cross-profile data is shown from cache.
 */
let activeEstateProfileId: string | null = null;

export function setActiveEstateProfileId(id: string | null): void {
  activeEstateProfileId = id;
}

export function getActiveEstateProfileId(): string | null {
  return activeEstateProfileId;
}

/**
 * Install a request interceptor that injects `?profileId` on profile-scoped
 * estate endpoints. Skips `/estate/profiles*` (managing profiles) and
 * `/estate/nominee-access*` (public, token-scoped).
 */
export function installEstateProfileParam(http: AxiosInstance): void {
  http.interceptors.request.use((config) => {
    const url = config.url ?? '';
    const isEstate = url.startsWith('/estate/') || url === '/estate';
    const exempt =
      url.startsWith('/estate/profiles') ||
      url.startsWith('/estate/nominee-access');
    if (isEstate && !exempt && activeEstateProfileId) {
      config.params = { ...(config.params ?? {}), profileId: activeEstateProfileId };
    }
    return config;
  });
}
