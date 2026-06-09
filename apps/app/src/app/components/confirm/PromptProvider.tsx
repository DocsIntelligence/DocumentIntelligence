import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@org/ui';
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

export interface PromptOptions {
  /** Dialog heading. */
  title: string;
  /** Optional supporting line. */
  description?: string;
  /** Field label above the input. */
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Submit button label. Defaults to a translated "OK". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to a translated "Cancel". */
  cancelLabel?: string;
  /** When true, an empty/whitespace value cannot be submitted. Default false. */
  required?: boolean;
}

type PromptFn = (options: PromptOptions) => Promise<string | null>;

const PromptContext = createContext<PromptFn | null>(null);

/**
 * Imperative, promise-based replacement for the native `window.prompt`.
 * Resolves the entered string on submit, or `null` on cancel/dismiss — a
 * drop-in for `const v = (await prompt({...})) ?? fallback;`.
 */
export function usePrompt(): PromptFn {
  const ctx = useContext(PromptContext);
  if (!ctx) {
    throw new Error('usePrompt must be used within a <PromptProvider>');
  }
  return ctx;
}

/**
 * Mounts a single shared text-input modal at the app root and exposes it via
 * {@link usePrompt}. One dialog instance serves every call site; the promise
 * resolver is tracked in a ref and settled exactly once.
 */
export function PromptProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [value, setValue] = useState('');
  const resolverRef = useRef<((value: string | null) => void) | null>(null);
  const inputId = useId();

  const prompt = useCallback<PromptFn>((opts) => {
    setOptions(opts);
    setValue(opts.defaultValue ?? '');
    setOpen(true);
    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: string | null) => {
    // Guard against a double-resolve (e.g. submit + close event).
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  // Overlay click / Esc / close button → treat as cancel.
  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) settle(null);
    },
    [settle],
  );

  const onSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      settle(value);
    },
    [settle, value],
  );

  const submitDisabled =
    (options?.required ?? false) && value.trim().length === 0;

  return (
    <PromptContext.Provider value={prompt}>
      {children}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>{options?.title}</DialogTitle>
              {options?.description ? (
                <DialogDescription>{options.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            <div className="space-y-2 py-4">
              {options?.label ? (
                <Label htmlFor={inputId}>{options.label}</Label>
              ) : null}
              <Input
                id={inputId}
                autoFocus
                value={value}
                placeholder={options?.placeholder}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => settle(null)}
              >
                {options?.cancelLabel ?? t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={submitDisabled}>
                {options?.confirmLabel ?? t('common.ok', 'OK')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PromptContext.Provider>
  );
}
