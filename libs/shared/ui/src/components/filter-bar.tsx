import { type ReactNode } from 'react';
import { cn } from '@org/utils';
import { Button } from './button';
import { Input } from './input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

/** Sentinel value for a select's "All …" option. Radix forbids value="" on a
 *  SelectItem, so an empty filter is represented as '' in the caller's state
 *  and mapped to this token only at the Radix boundary. */
const ALL = '__all';

export interface FilterBarSelectOption {
  value: string;
  label: ReactNode;
}

export interface FilterBarSelect {
  /** Stable id (React key). */
  id: string;
  /** Current value; `''` means "All" (the sentinel option). */
  value: string;
  onChange: (value: string) => void;
  options: FilterBarSelectOption[];
  /** Label for the sentinel "All" option, e.g. "All statuses". */
  allLabel: string;
  /** Trigger placeholder shown when the value is empty. Defaults to allLabel. */
  placeholder?: string;
  /** Tailwind width class for the trigger. Defaults to `w-[160px]`. */
  widthClassName?: string;
  /** Hide this select entirely (e.g. only one option available). */
  hidden?: boolean;
}

export interface FilterBarSearch {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tailwind width class. Defaults to `w-full sm:w-64`. */
  widthClassName?: string;
}

export interface FilterBarProps {
  /** Optional leading search box. Omit when the surrounding DataTable already
   *  renders its own `search` input (the standard for in-table filter rows). */
  search?: FilterBarSearch;
  selects?: FilterBarSelect[];
  /** Clear handler — the button shows only when a filter is active (see
   *  `dirty`). Pair with a `clearLabel`. */
  onClear?: () => void;
  clearLabel?: string;
  /** Force the Clear button's visibility. Defaults to "any select non-empty or
   *  search non-blank". */
  dirty?: boolean;
  /** Extra controls appended after the selects (before Clear). */
  children?: ReactNode;
  className?: string;
}

/**
 * Standardized filter row — a search box (optional), a set of "All …"-sentinel
 * `Select` dropdowns, and a conditional Clear button — laid out as a single
 * `flex-wrap` row. This is the one filter UI used across every list/table in
 * the app (mirrors the AI-usage page that set the bar). Drop it into a
 * DataTable's `toolbar` prop (search handled by the table) or render it
 * standalone (pass `search`).
 *
 * Strings (placeholders, "All …" labels, Clear) are passed in by the caller so
 * the component stays i18n-free.
 */
export function FilterBar({
  search,
  selects = [],
  onClear,
  clearLabel = 'Clear',
  dirty,
  children,
  className,
}: FilterBarProps) {
  const visibleSelects = selects.filter((s) => !s.hidden);
  const isDirty =
    dirty ??
    ((!!search && search.value.trim() !== '') ||
      visibleSelects.some((s) => s.value !== ''));

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {search && (
        <Input
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          placeholder={search.placeholder}
          className={cn('h-9', search.widthClassName ?? 'w-full sm:w-64')}
        />
      )}
      {visibleSelects.map((s) => (
        <Select
          key={s.id}
          value={s.value === '' ? ALL : s.value}
          onValueChange={(v) => s.onChange(v === ALL ? '' : v)}
        >
          <SelectTrigger className={cn('h-9', s.widthClassName ?? 'w-[160px]')}>
            <SelectValue placeholder={s.placeholder ?? s.allLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{s.allLabel}</SelectItem>
            {s.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {children}
      {onClear && isDirty && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          {clearLabel}
        </Button>
      )}
    </div>
  );
}

export default FilterBar;
