interface Section {
  key: string;
  label: string;
}

interface Props {
  sections: Section[];
  activeKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * Left sidebar — flat list of section anchors. Clicking scrolls the
 * corresponding section into view in the middle form pane.
 */
export function SectionsTree({ sections, activeKey, onSelect }: Props) {
  return (
    <nav className="p-3 text-sm">
      <p className="text-[10px] uppercase tracking-wide font-medium text-foreground/40 mb-2 px-2">
        Sections
      </p>
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const active = s.key === activeKey;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                className={[
                  'w-full text-left px-2 py-1.5 rounded-md transition-colors',
                  active
                    ? 'bg-primary/50 text-primary font-medium'
                    : 'hover:bg-foreground/5 text-foreground/80',
                ].join(' ')}
              >
                {s.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
