import { cn } from '@org/utils';
import { forwardRef } from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected styling (filled). */
  active?: boolean;
}

/**
 * A small pill-shaped toggle button for filters/segments. Extracted from the
 * batch-detail status filters so document/batch lists can share one look.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition',
        active
          ? 'border-primary bg-primary/50 text-primary'
          : 'border-border text-foreground/60 hover:bg-secondary',
        className,
      )}
      {...props}
    />
  ),
);

Chip.displayName = 'Chip';
