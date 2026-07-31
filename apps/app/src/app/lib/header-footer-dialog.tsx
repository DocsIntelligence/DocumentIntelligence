import { useEffect, useState } from 'react';
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

export interface HeaderFooterDialogProps {
  headerText?: string | null;
  footerText?: string | null;
  onSave: (values: { headerText: string; footerText: string }) => void;
  className?: string;
}

/**
 * Toolbar control for the repeating page header/footer (printed on every
 * page — see `Page.tsx` in `@org/document-templates`). A single component
 * owns its own dialog state, mirroring `PageSizeSelect`'s "drop into a
 * toolbar" ergonomics.
 */
export function HeaderFooterDialog({
  headerText,
  footerText,
  onSave,
  className,
}: HeaderFooterDialogProps) {
  const [open, setOpen] = useState(false);
  const [header, setHeader] = useState(headerText ?? '');
  const [footer, setFooter] = useState(footerText ?? '');

  // Re-sync the draft with the latest saved values whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setHeader(headerText ?? '');
      setFooter(footerText ?? '');
    }
  }, [open, headerText, footerText]);

  const handleSave = () => {
    onSave({ headerText: header.trim(), footerText: footer.trim() });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        Header/Footer
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Header & footer</DialogTitle>
          <DialogDescription>
            Repeated on every printed page. Use <code>{'{{pageNumber}}'}</code>{' '}
            and <code>{'{{totalPages}}'}</code> for page numbers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="header-text">Header</Label>
            <Input
              id="header-text"
              placeholder="e.g. ABC & Associates — Advocates"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              maxLength={300}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="footer-text">Footer</Label>
            <Input
              id="footer-text"
              placeholder="Page {{pageNumber}} of {{totalPages}}"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              maxLength={300}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
