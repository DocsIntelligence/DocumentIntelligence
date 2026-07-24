import type { ReactNode } from 'react';

/** Small, functional line icons (24x24, stroke = currentColor). No icon
 *  package dependency — this is the full set the landing page needs. */
export const icons = {
  document: (
    <>
      <path d="M7 3h7l4 4v14a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 16.5h6M9 9.5h2" />
    </>
  ),
  notice: (
    <>
      <path d="M4 10a8 8 0 0116 0v4a8 8 0 01-16 0z" />
      <path d="M9 21a3 3 0 006 0" />
      <path d="M12 6v3" />
    </>
  ),
  scroll: (
    <>
      <path d="M6 4h11a2 2 0 012 2v13a1 1 0 01-1.6.8L15 18H8a3 3 0 01-3-3V6a2 2 0 012-2z" />
      <path d="M6 4a2 2 0 100 4" />
      <path d="M9 9h6M9 12.5h6" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l8-8M16 7l2 2M19 4l1 1" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 4.4-3 7.5-7 9-4-1.5-7-4.6-7-9V6z" />
      <path d="M9 12l2 2 4-4.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="2.4" />
      <circle cx="16" cy="9" r="2" />
      <path d="M4.5 18a4.5 4.5 0 019 0M14 18a4 4 0 015.5-3.7" />
    </>
  ),
  gavel: (
    <>
      <path d="M13 5l6 6M9 9l6 6" />
      <path d="M4 20l6-6M15 4l5 5-3 3-5-5z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7.5" width="18" height="12" rx="2" />
      <path d="M8 7.5V6a2 2 0 012-2h4a2 2 0 012 2v1.5" />
      <path d="M3 12.5h18" />
    </>
  ),
  sparkles: (
    <>
      <path d="M11 3l1.5 3.8L16 8l-3.5 1.2L11 13 9.5 9.2 6 8l3.5-1.2z" />
      <path d="M17.5 13l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3l8 4-8 4-8-4z" />
      <path d="M4 11l8 4 8-4M4 15l8 4 8-4" />
    </>
  ),
  languages: (
    <>
      <path d="M4 6h9M8 3v3M6.5 6a7 7 0 004.7 6.5M11 6a9 9 0 01-6.2 8.5" />
      <path d="M14 21l3.5-9 3.5 9M15.3 18h4.4" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v11" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
    </>
  ),
} as const;

export type IconName = keyof typeof icons;

export function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {icons[name] as ReactNode}
    </svg>
  );
}
