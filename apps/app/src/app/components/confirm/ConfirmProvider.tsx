import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmOptions {
  /** Dialog heading (the question). */
  title: string;
  /** Optional supporting line (e.g. consequences). */
  description?: string;
  /** Confirm button label. Defaults to a translated "Confirm". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to a translated "Cancel". */
  cancelLabel?: string;
  /** `destructive` paints the confirm button in the error colour. */
  variant?: 'default' | 'destructive';
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Imperative, promise-based replacement for the native `window.confirm`.
 * Resolves `true` on confirm, `false` on cancel/dismiss — a drop-in for
 * `if (!(await confirm({...}))) return;` inside async handlers.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within a <ConfirmProvider>');
  }
  return ctx;
}

/**
 * Mounts a single shared confirmation modal at the app root and exposes it
 * via {@link useConfirm}. One dialog instance serves every call site, so the
 * promise resolver is tracked in a ref and settled exactly once.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    // Guard against a double-resolve (e.g. button click + close event).
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  // Overlay click / Esc / close button → treat as cancel.
  const onOpenChange = useCallback(
    (next: boolean) => {
      if (!next) settle(false);
    },
    [settle],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            {options?.description ? (
              <DialogDescription>{options.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {options?.cancelLabel ?? t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant={options?.variant === 'destructive' ? 'error' : 'primary'}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? t('common.confirm', 'Confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
