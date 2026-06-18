import { cn } from '@org/utils';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/**
 * Dependency-free calendar + date picker for the design system. Values are
 * `YYYY-MM-DD` strings (date-only, timezone-safe — we never go through
 * `toISOString()`). Built on the shared Popover, styled like SelectTrigger.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseISO(v?: string): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mo}-${da}`;
}

function formatHuman(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function Calendar({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (iso: string) => void;
}) {
  const selected = parseISO(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const todayISO = toISO(new Date());

  const navBtn =
    'flex h-7 w-7 items-center justify-center rounded hover:bg-secondary text-foreground/70';

  return (
    <div className="w-64 select-none">
      <div className="flex items-center justify-between pb-2">
        <button
          type="button"
          aria-label="Previous month"
          className={navBtn}
          onClick={() => setView(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span className="text-sm font-medium">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className={navBtn}
          onClick={() => setView(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 pb-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const iso = toISO(new Date(year, month, day));
          const isSelected = value === iso;
          const isToday = todayISO === iso;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                'h-8 rounded text-sm transition-colors hover:bg-secondary',
                isSelected &&
                  'bg-primary text-primary-foreground hover:bg-primary',
                !isSelected && isToday && 'border border-primary/50',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between pt-2 text-xs">
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => onSelect(todayISO)}
        >
          Today
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:underline"
          onClick={() => onSelect('')}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const d = parseISO(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded border border-border bg-transparent px-3 py-2 text-sm shadow-sm transition-colors hover:bg-secondary/40 focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50',
            !d && 'text-muted-foreground',
            className,
          )}
        >
          {d ? formatHuman(d) : placeholder}
          <CalendarGlyph />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          value={value}
          onSelect={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function CalendarGlyph() {
  return (
    <svg
      className="size-4 shrink-0 opacity-60"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  );
}
