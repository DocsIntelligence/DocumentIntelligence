import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@org/ui';
import { cn } from '@org/utils';

import { TEMPLATES } from '../templates/registry';
import type { DocumentTemplate } from '../templates/types';

export type TemplateGalleryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: DocumentTemplate) => void;
  /** Disable a template (e.g. the one currently loaded). */
  activeId?: string;
};

export function TemplateGallery({
  open,
  onOpenChange,
  onSelect,
  activeId,
}: TemplateGalleryProps) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? TEMPLATES.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.category.toLowerCase().includes(q),
        )
      : TEMPLATES;
    const map = new Map<string, DocumentTemplate[]>();
    for (const t of filtered) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return Array.from(map.entries());
  }, [query]);

  const handlePick = (t: DocumentTemplate) => {
    onSelect(t);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] !max-w-3xl gap-3 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 pt-5 pb-3">
          <DialogTitle className="text-base">Choose a Template</DialogTitle>
          <DialogDescription className="text-xs">
            Pick a starting point. You can edit any text, formatting, or
            placeholders afterwards.
          </DialogDescription>
          <div className="pt-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates..."
              className="h-8 text-sm"
            />
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 pb-6">
          {grouped.length === 0 && (
            <div className="py-12 text-center text-sm text-foreground/55">
              No templates match "{query}".
            </div>
          )}
          {grouped.map(([category, items]) => (
            <div key={category} className="mb-4 last:mb-0">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/55">
                {category}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((t) => {
                  const active = t.id === activeId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handlePick(t)}
                      className={cn(
                        'group flex items-start gap-3 rounded-md border border-border bg-background p-3 text-left transition-all hover:border-primary/60 hover:bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-primary/40',
                        active && 'border-primary ring-1 ring-primary/40',
                      )}
                    >
                      <div className="flex size-9 flex-none items-center justify-center rounded bg-secondary/50 text-lg">
                        {t.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {t.name}
                          </span>
                          {active && (
                            <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary">
                              Loaded
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-foreground/65">
                          {t.description}
                        </p>
                        {t.placeholders.length > 0 && (
                          <p className="mt-1 text-[10px] text-foreground/50">
                            {t.placeholders.length} field
                            {t.placeholders.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
