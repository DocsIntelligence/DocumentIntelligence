import {
  Button,
  Checkbox,
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
import { documentTypeLabel } from '../documents/document-label';
import { useAddDocumentsToGroup, useGroupsPage } from './queries';

export interface AddToGroupTarget {
  id: string;
  title: string;
  group: { id: string; name: string; kind: string } | null;
}

interface AddDocToGroupDialogProps {
  /**
   * Documents the user has selected. We need the current `group` so we can
   * enforce the single-group invariant: an ungrouped doc gets added, a doc
   * already in the target group is a no-op, a doc in a DIFFERENT group is
   * skipped unless the user explicitly enables "Move".
   */
  documents: AddToGroupTarget[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Dialog shown from the Documents list: pick a target group and add (or
 * explicitly MOVE) the selected document(s). Each Document belongs to at most
 * one group; we surface that constraint up-front so the user isn't surprised
 * when some docs silently no-op.
 */
export function AddDocToGroupDialog({
  documents,
  open,
  onOpenChange,
}: AddDocToGroupDialogProps) {
  const { t } = useTranslation();
  const addDocs = useAddDocumentsToGroup();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [allowMove, setAllowMove] = useState(false);

  const { data } = useGroupsPage({
    pageSize: 100,
    sort: 'updated',
    dir: 'desc',
  });
  const groups = data?.items ?? [];

  // Split selection: which docs are eligible (ungrouped OR already in target)
  // vs in a different group. The split depends on which target is chosen.
  const { eligible, alreadyHere, inOtherGroup } = useMemo(() => {
    const eligibleArr: AddToGroupTarget[] = [];
    const alreadyHereArr: AddToGroupTarget[] = [];
    const inOtherGroupArr: AddToGroupTarget[] = [];
    for (const doc of documents) {
      if (!doc.group) {
        eligibleArr.push(doc);
      } else if (doc.group.id === selectedGroupId) {
        alreadyHereArr.push(doc);
      } else {
        inOtherGroupArr.push(doc);
      }
    }
    return {
      eligible: eligibleArr,
      alreadyHere: alreadyHereArr,
      inOtherGroup: inOtherGroupArr,
    };
  }, [documents, selectedGroupId]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setSelectedGroupId('');
      setAllowMove(false);
    }
  }, [open]);

  const handleSubmit = () => {
    if (!selectedGroupId || documents.length === 0) return;
    addDocs.mutate(
      {
        groupId: selectedGroupId,
        documentIds: documents.map((d) => d.id),
        overwrite: allowMove,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSelectedGroupId('');
          setAllowMove(false);
        },
      },
    );
  };

  const willAdd = eligible.length + (allowMove ? inOtherGroup.length : 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('groups.addToGroup', 'Add to group')}</DialogTitle>
          <DialogDescription>
            {t(
              'groups.addToGroupDesc',
              'A document can belong to one group at a time. Docs already in another group are skipped unless you explicitly move them.',
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

          {selectedGroupId && (
            <div className="space-y-2 rounded-md border border-border bg-secondary/35 p-3 text-xs">
              <p className="font-medium text-foreground">
                {t('groups.preview', 'Of the {{n}} selected:', {
                  n: documents.length,
                })}
              </p>
              <ul className="space-y-1 text-foreground/70">
                <li>
                  <span className="font-medium text-foreground">
                    {eligible.length}
                  </span>{' '}
                  {t('groups.addEligible', 'will be added (ungrouped).')}
                </li>
                {alreadyHere.length > 0 && (
                  <li>
                    <span className="font-medium text-foreground">
                      {alreadyHere.length}
                    </span>{' '}
                    {t('groups.alreadyHere', 'already in this group (no-op).')}
                  </li>
                )}
                {inOtherGroup.length > 0 && (
                  <li className="text-warning-foreground">
                    <span className="font-medium">{inOtherGroup.length}</span>{' '}
                    {t(
                      'groups.inOtherGroup',
                      "are in another group — won't be added unless you choose Move.",
                    )}
                  </li>
                )}
              </ul>

              {inOtherGroup.length > 0 && (
                <label className="flex cursor-pointer items-start gap-2 pt-1">
                  <Checkbox
                    checked={allowMove}
                    onCheckedChange={(v) => setAllowMove(v === true)}
                    className="mt-0.5"
                  />
                  <span className="text-xs">
                    {t(
                      'groups.moveFromOther',
                      `Move the ${inOtherGroup.length} doc(s) out of their current group.`,
                    )}
                  </span>
                </label>
              )}
            </div>
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
            disabled={!selectedGroupId || addDocs.isPending || willAdd === 0}
            onClick={handleSubmit}
          >
            {addDocs.isPending
              ? t('common.adding', 'Adding…')
              : t(
                  'groups.addBtn',
                  `${allowMove && inOtherGroup.length > 0 ? 'Add & move' : 'Add'} ${willAdd || ''}`,
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
 * Multi-select via prominent leading checkboxes, debounced server search, a
 * "Select all visible / Clear" toggle, and a sticky count + Add CTA in the
 * footer. Holds the picker in-page so users don't lose context.
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

  // Single-group invariant: only show docs that aren't in any group yet
  // (or were excluded because they're already here). A doc already in another
  // group must be moved explicitly from the documents list "Add to group"
  // flow, never silently pulled into a different group via this picker.
  const available = useMemo(() => {
    const existing = new Set(existingDocIds);
    return (data?.items ?? []).filter(
      (d) => !existing.has(d.id) && !(d as { group?: unknown }).group,
    );
  }, [data, existingDocIds]);

  const allVisibleSelected =
    available.length > 0 && available.every((d) => selected.has(d.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const d of available) next.delete(d.id);
        return next;
      }
      const next = new Set(prev);
      for (const d of available) next.add(d.id);
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{t('groups.addDocsTitle', 'Add documents to group')}</span>
            {selected.size > 0 && (
              <span className="rounded-full bg-primary/50 px-2.5 py-0.5 text-xs font-medium text-primary">
                {t('groups.selectedCount', `${selected.size} selected`)}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            {t(
              'groups.addDocsDesc',
              'A document can belong to one group at a time — only ungrouped documents are shown. To move a doc out of another group, use "Add to group" from the documents list.',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder={t('groups.searchDocs', 'Search documents…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {/* Toolbar: select-all + result count */}
          <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              disabled={available.length === 0}
              className="font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50 hover:underline"
            >
              {allVisibleSelected
                ? t('groups.deselectAll', 'Clear selection on this page')
                : t('groups.selectAllVisible', 'Select all on this page')}
            </button>
            <span className="text-foreground/50">
              {available.length}{' '}
              {available.length === 1
                ? t('groups.result', 'result')
                : t('groups.results', 'results')}
            </span>
          </div>

          <div className="max-h-72 space-y-0.5 overflow-y-auto rounded-md border border-border p-1">
            {available.length === 0 ? (
              <p className="py-6 text-center text-sm text-foreground/50">
                {t('groups.noDocsAvailable', 'No documents available to add.')}
              </p>
            ) : (
              available.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => toggleSelect(doc.id)}
                  className={`flex w-full items-center gap-3 rounded px-2 py-2 text-left text-sm transition-colors ${
                    selected.has(doc.id)
                      ? 'bg-primary/50 text-primary'
                      : 'hover:bg-secondary/60'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition ${
                      selected.has(doc.id)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border'
                    }`}
                  >
                    {selected.has(doc.id) && (
                      <svg
                        className="size-3.5"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M2.5 6.5L5 9l4.5-6" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {doc.title || t('common.untitled', 'Untitled')}
                  </span>
                  <span className="shrink-0 text-xs text-foreground/45">
                    {documentTypeLabel(doc, t('common.document', 'Document'))}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
        <DialogFooter className="items-center justify-between gap-2 sm:justify-between">
          <span className="text-xs text-foreground/55">
            {selected.size === 0
              ? t('groups.pickToContinue', 'Pick one or more to continue.')
              : t('groups.willAdd', `Will add ${selected.size} to this group.`)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={addDocs.isPending}
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
                    `Add ${selected.size || ''} document${selected.size === 1 ? '' : 's'}`,
                  )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
