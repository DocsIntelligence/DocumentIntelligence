import { cn } from '@org/utils';
import { forwardRef } from 'react';

export type InputProps = {
  hasError?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, hasError = false, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      // Default the a11y state from `hasError`; an explicit `aria-invalid` in
      // props (e.g. injected by FormField) still wins via the spread below.
      aria-invalid={hasError || undefined}
      className={cn(
        'flex h-9 w-full rounded border border-border bg-transparent px-3 py-0.5 !text-sm ring-0 ring-offset-transparent transition-colors [appearance:textfield] placeholder:opacity-80 hover:bg-secondary/40 focus:border-primary focus:bg-secondary/40 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        'file:border-0 file:bg-transparent file:pt-1 file:text-sm file:font-medium file:text-primary',
        hasError ? 'border-error' : 'border-border',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
