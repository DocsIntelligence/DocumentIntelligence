import type { Warning } from '@org/document-schema';

interface Props {
  warnings: Warning[];
  onJump?: (fieldPath: string) => void;
}

const severityStyles: Record<Warning['severity'], string> = {
  error: 'bg-red-50 border-red-300 text-red-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  info: 'bg-blue-50 border-blue-300 text-blue-900',
};

export function RisksPanel({ warnings, onJump }: Props) {
  if (warnings.length === 0) {
    return (
      <div className="p-4 text-xs text-foreground/50">
        <p className="font-medium text-foreground/70 mb-1">
          All checks passed.
        </p>
        <p>
          We'll flag missing essentials and state-specific issues as you fill
          the form.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wide font-medium text-foreground/40 px-1">
        Checks ({warnings.length})
      </p>
      <ul className="space-y-2">
        {warnings.map((w) => (
          <li
            key={w.id}
            className={[
              'text-xs border rounded-md px-3 py-2',
              severityStyles[w.severity],
            ].join(' ')}
          >
            <p className="leading-snug">{w.message}</p>
            {w.fieldPath && onJump && (
              <button
                type="button"
                onClick={() => {
                  if (w.fieldPath) onJump(w.fieldPath);
                }}
                className="mt-1 text-[10px] underline opacity-80 hover:opacity-100"
              >
                Jump to field
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
