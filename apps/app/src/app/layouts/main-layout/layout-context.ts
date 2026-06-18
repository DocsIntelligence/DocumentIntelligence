import { createContext, useContext } from 'react';

/**
 * Shell-level layout controls shared with pages (via {@link PageHeader}). Lets a
 * page header toggle the sidebar without prop-drilling through every route.
 */
export interface LayoutContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const LayoutContext = createContext<LayoutContextValue | null>(null);

/** Null when rendered outside the authenticated shell (e.g. public pages). */
export function useLayout(): LayoutContextValue | null {
  return useContext(LayoutContext);
}
