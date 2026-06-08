import type { PageSizeKey } from '@org/document-templates';
import { cn } from '@org/utils';

/** Paper sizes, aligned with the Prisma PageSize enum + document-templates profiles. */
export const PAGE_SIZE_OPTIONS: { value: PageSizeKey; label: string }[] = [
  { value: 'a4', label: 'A4' },
  { value: 'legal', label: 'Legal' },
  { value: 'foolscap', label: 'Foolscap' },
  { value: 'stamp_paper_in_10', label: 'Stamp paper ₹10' },
  { value: 'stamp_paper_in_20', label: 'Stamp paper ₹20' },
  { value: 'stamp_paper_in_50', label: 'Stamp paper ₹50' },
  { value: 'stamp_paper_in_100', label: 'Stamp paper ₹100' },
  { value: 'stamp_paper_in_500', label: 'Stamp paper ₹500' },
];

export function PageSizeSelect({
  value,
  onChange,
  id,
  className,
  title = 'Paper size',
}: {
  value: PageSizeKey;
  onChange: (value: PageSizeKey) => void;
  id?: string;
  className?: string;
  title?: string;
}) {
  return (
    <select
      id={id}
      title={title}
      value={value}
      onChange={(e) => onChange(e.target.value as PageSizeKey)}
      className={cn(
        'h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40',
        className,
      )}
    >
      {PAGE_SIZE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
