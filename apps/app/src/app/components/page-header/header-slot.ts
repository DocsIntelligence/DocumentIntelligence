import { createContext, useContext, type ReactNode } from 'react';

/**
 * Optional content injected into the right side of every {@link PageHeader}
 * within a subtree — e.g. the Estate module feeds its profile switcher here so
 * it renders as part of each page's header instead of a separate bar above it.
 */
export const PageHeaderSlotContext = createContext<ReactNode>(null);

export function usePageHeaderSlot(): ReactNode {
  return useContext(PageHeaderSlotContext);
}
