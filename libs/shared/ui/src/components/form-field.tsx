import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@org/utils';

export interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Labelled form control. The label wraps the control (implicit association); when
 * the child is a single element we also inject `aria-describedby` → the error/hint
 * text and `aria-invalid` on error, so screen readers announce validation state.
 * The error is `role="alert"` so it is announced the moment it appears.
 */
export const FormField = ({
  label,
  error,
  hint,
  htmlFor,
  className,
  children,
}: FormFieldProps) => {
  const autoId = useId();
  const baseId = htmlFor ?? autoId;
  const msgId = error ? `${baseId}-error` : hint ? `${baseId}-hint` : undefined;

  const control =
    isValidElement(children) && msgId
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-invalid': error
            ? true
            : (children.props as Record<string, unknown>)['aria-invalid'],
          'aria-describedby':
            [
              (children.props as Record<string, unknown>)['aria-describedby'],
              msgId,
            ]
              .filter(Boolean)
              .join(' ') || undefined,
        })
      : children;

  return (
    <label className={cn('block space-y-1.5', className)} htmlFor={htmlFor}>
      <span className="text-sm font-medium text-foreground">{label}</span>
      {control}
      {error ? (
        <span id={msgId} role="alert" className="text-xs text-error">
          {error}
        </span>
      ) : hint ? (
        <span id={msgId} className="text-xs text-foreground/60">
          {hint}
        </span>
      ) : null}
    </label>
  );
};
