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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentsPage } from '../documents/queries';
import { useAddDocumentsToGroup, useGroupsPage } from './queries';

interface AddDocToGroupDialogProps {
  /** Pre-selected document IDs (from documents list context). */
  documentIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Dialog shown from the Documents list: pick a group to add the doc(s) into.
 */
export function AddDocToGroupDialog({
  documentIds,
  open,
  onOpenChange,
}: AddDocToGroupDialogProps) {
  const { t } = useTranslation();
  const addDocs = useAddDocumentsToGroup();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const { data } = useGroupsPage({
    pageSize: 100,
    sort: 'updated',
    dir: 'desc',
  });
  const groups = data?.items ?? [];

  const handleSubmit = () => {
    if (!selectedGroupId || documentIds.length === 0) return;
    addDocs.mutate(
      { groupId: selectedGroupId, documentIds },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedGroupId('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('groups.addToGroup', 'Add to group')}</DialogTitle>
          <DialogDescription>
            {t(
              'groups.addToGroupDesc',
              'Select a group to add the selected document(s) into.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-3">
          <Label>{t('groups.selectGroup', 'Group')}</Label>
          {groups.length === 0 ? (
            <p className="text-sm text-foreground/60">
              {t(
                'groups.noGroupsYet',
                'No groups yet. Create one first from the Groups page.',
              )}
            </p>
          ) : (
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={t('groups.pickGroup', 'Pick a group…')}
                />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.kind === 'bundle'
                      ? '📦'
                      : g.kind === 'matter'
                        ? '⚖️'
                        : '📁'}{' '}
                    {g.name} ({g.documentCount} docs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={!selectedGroupId || addDocs.isPending}
            onClick={handleSubmit}
          >
            {addDocs.isPending
              ? t('common.adding', 'Adding…')
              : t(
                  'groups.addBtn',
                  `Add ${documentIds.length > 1 ? `${documentIds.length} docs` : 'document'}`,
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddDocsToCurrentGroupDialogProps {
  /** The group to add documents to. */
  groupId: string;
  /** IDs already in the group (to exclude from picker). */
  existingDocIds: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Dialog shown from the Group detail page: pick documents to add to this group.
 */
export function AddDocsToCurrentGroupDialog({
  groupId,
  existingDocIds,
  open,
  onOpenChange,
}: AddDocsToCurrentGroupDialogProps) {
  const { t } = useTranslation();
  const addDocs = useAddDocumentsToGroup();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data } = useDocumentsPage({
    pageSize: 50,
    q: search.trim() || undefined,
    sort: 'updated',
    dir: 'desc',
  });

  const available = useMemo(() => {
    const existing = new Set(existingDocIds);
    return (data?.items ?? []).filter((d) => !existing.has(d.id));
  }, [data, existingDocIds]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    addDocs.mutate(
      { groupId, documentIds: Array.from(selected) },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelected(new Set());
          setSearch('');
        },
      },
    );
  };

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setSearch('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t('groups.addDocsTitle', 'Add documents to group')}
          </DialogTitle>
          <DialogDescription>
            {t('groups.addDocsDesc', 'Select documents to add to this group.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder={t('groups.searchDocs', 'Search documents…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {available.length === 0 ? (
              <p className="py-4 text-center text-sm text-foreground/50">
                {t('groups.noDocsAvailable', 'No documents available to add.')}
              </p>
            ) : (
              available.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggleSelect(doc.id)}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                    selected.has(doc.id)
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary/60'
                  }`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      selected.has(doc.id)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border'
                    }`}
                  >
                    {selected.has(doc.id) && (
                      <svg
                        className="size-3"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2.5 6.5L5 9l4.5-6" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                  <span className="text-xs text-foreground/40">
                    {(doc as { documentType?: { name: string } }).documentType
                      ?.name ?? 'Freeform'}
                  </span>
                </button>
              ))
            )}
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-foreground/60">
              {selected.size} document{selected.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || addDocs.isPending}
            onClick={handleSubmit}
          >
            {addDocs.isPending
              ? t('common.adding', 'Adding…')
              : t(
                  'groups.addSelected',
                  `Add ${selected.size || ''} document${selected.size !== 1 ? 's' : ''}`,
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
