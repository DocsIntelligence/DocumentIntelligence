import { cn } from '@org/utils';
import { forwardRef } from 'react';

export type SuggestionPopoverProps = {
  suggestions: string[];
  selectedIndex: number;
  onSelect: (suggestion: string, index: number) => void;
  visible: boolean;
  position?: { top: number; left: number };
  className?: string;
};

export const SuggestionPopover = forwardRef<
  HTMLDivElement,
  SuggestionPopoverProps
>(
  (
    { suggestions, selectedIndex, onSelect, visible, position, className },
    ref,
  ) => {
    if (!visible || suggestions.length === 0) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'absolute z-50 min-w-48 overflow-hidden rounded-md border bg-background p-1 shadow-md animate-in fade-in-0 zoom-in-95',
          className,
        )}
        style={
          position
            ? { top: `${position.top}px`, left: `${position.left}px` }
            : undefined
        }
      >
        <div className="px-2 py-1 text-xs font-medium text-foreground/60">
          Suggestions
        </div>
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            type="button"
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
              index === selectedIndex
                ? 'bg-primary/50 text-primary'
                : 'hover:bg-secondary',
            )}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent editor blur
              onSelect(suggestion, index);
            }}
          >
            <span className="inline-flex size-5 items-center justify-center rounded bg-secondary text-xs font-medium">
              {index + 1}
            </span>
            <span className="text-base">{suggestion}</span>
          </button>
        ))}
        <div className="border-t px-2 py-1 text-[10px] text-foreground/40">
          ↑↓ navigate · Enter/Tab select · 1-5 pick · Esc dismiss
        </div>
      </div>
    );
  },
);

SuggestionPopover.displayName = 'SuggestionPopover';
