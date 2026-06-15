import { Tooltip } from '@org/ui';

/**
 * 4-button segmented control selecting which side panes are visible.
 * Replaces two independent sidebar/preview toggles — fewer clicks to
 * jump between layouts, single source of truth (the booleans the host
 * already manages). Order: focus → outline → review → full, which
 * corresponds to "increasing surface area" left-to-right.
 *
 * Shared between TemplateEditor (freeform) and BuilderShell (structured)
 * so both editors expose the exact same layout control.
 */
export function LayoutPresetGroup({
  showSidebar,
  showPreview,
  onChange,
  t,
}: {
  showSidebar: boolean;
  showPreview: boolean;
  onChange: (sidebar: boolean, preview: boolean) => void;
  /** Translator — pass `useTranslation().t` from the caller. */
  t: (key: string, defaultValue: string) => string;
}) {
  const presets = [
    {
      id: 'focus',
      label: t('editor.layout.focus', 'Focus (editor only)'),
      sidebar: false,
      preview: false,
      icon: <FocusLayoutIcon />,
    },
    {
      id: 'outline',
      label: t('editor.layout.outline', 'Sidebar + editor'),
      sidebar: true,
      preview: false,
      icon: <OutlineLayoutIcon />,
    },
    {
      id: 'review',
      label: t('editor.layout.review', 'Editor + preview'),
      sidebar: false,
      preview: true,
      icon: <ReviewLayoutIcon />,
    },
    {
      id: 'full',
      label: t('editor.layout.full', 'All panes'),
      sidebar: true,
      preview: true,
      icon: <FullLayoutIcon />,
    },
  ];
  return (
    <div
      role="group"
      aria-label={t('editor.layout.group', 'Layout')}
      className="flex flex-none items-center rounded-md border border-border bg-background p-0.5"
    >
      {presets.map((p) => {
        const active = p.sidebar === showSidebar && p.preview === showPreview;
        return (
          <Tooltip key={p.id} content={p.label}>
            <button
              type="button"
              aria-label={p.label}
              aria-pressed={active}
              onClick={() => onChange(p.sidebar, p.preview)}
              className={`flex size-7 flex-none items-center justify-center rounded transition-colors ${
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-foreground/55 hover:bg-secondary hover:text-foreground'
              }`}
            >
              {p.icon}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function FocusLayoutIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
    </svg>
  );
}

function OutlineLayoutIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="5" y1="8" x2="7" y2="8" />
      <line x1="5" y1="11" x2="7" y2="11" />
      <line x1="5" y1="14" x2="7" y2="14" />
    </svg>
  );
}

function ReviewLayoutIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="14" y1="4" x2="14" y2="20" />
    </svg>
  );
}

function FullLayoutIcon() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <line x1="8" y1="4" x2="8" y2="20" />
      <line x1="16" y1="4" x2="16" y2="20" />
    </svg>
  );
}
