const baseProps = {
  className: 'size-4',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function FieldsIcon() {
  return (
    <svg {...baseProps}>
      <path d="M3 5h18M3 12h18M3 19h12" />
    </svg>
  );
}
export function PagesIcon() {
  return (
    <svg {...baseProps}>
      <rect x="4" y="3" width="12" height="18" rx="1.5" />
      <path d="M8 7h4M8 11h4M8 15h2" />
    </svg>
  );
}
export function LegalAiIcon() {
  return (
    <svg {...baseProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7M9 11h5" />
    </svg>
  );
}
export function CommentsIcon() {
  return (
    <svg {...baseProps}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
export function SignaturesIcon() {
  return (
    <svg {...baseProps}>
      <path d="M3 17c1.5 0 3-3 6-3s4 3 6 3 4-3 6-3" />
      <path d="M3 21h18" />
    </svg>
  );
}
export function HistoryIcon() {
  return (
    <svg {...baseProps}>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
export function ShareIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
export function CitationsIcon() {
  return (
    <svg {...baseProps}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
export function InsightsIcon() {
  return (
    <svg {...baseProps}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9.9-2.7z" />
    </svg>
  );
}
export function UsageIcon() {
  return (
    <svg {...baseProps}>
      <line x1="3" y1="20" x2="21" y2="20" />
      <rect x="6" y="10" width="3" height="9" />
      <rect x="11" y="6" width="3" height="13" />
      <rect x="16" y="13" width="3" height="6" />
    </svg>
  );
}
