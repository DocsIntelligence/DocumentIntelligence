import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import {
  useDocumentVersions,
  useRestoreVersion,
  useSnapshotDocument,
} from './queries';

/**
 * Version history for a document: lists snapshots (newest first), lets the user
 * save the current state as a version, and restore any prior one (the restore
 * itself first snapshots the current state, so it's reversible).
 */
export function VersionHistoryDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const versions = useDocumentVersions(documentId, open);
  const snapshot = useSnapshotDocument(documentId);
  const restore = useRestoreVersion(documentId);
  const items = versions.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Snapshots of this document. Restoring first saves the current state,
            so you can always undo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-1">
          <span className="text-xs text-foreground/55">
            {items.length} version{items.length === 1 ? '' : 's'}
          </span>
          <Button
            size="sm"
            variant="outline"
            isLoading={snapshot.isPending}
            onClick={() => snapshot.mutate('Manual save')}
          >
            Save current as version
          </Button>
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {versions.isLoading && (
            <p className="text-sm text-foreground/55">Loading…</p>
          )}
          {!versions.isLoading && items.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/55">
              No versions yet. Save one above, or they accrue as you restore.
            </p>
          )}
          {items.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {v.label || 'Snapshot'}
                </p>
                <p className="text-xs text-foreground/50">
                  {new Date(v.createdAt).toLocaleString()} ·{' '}
                  {v.pageSize.replace(/_/g, ' ')}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={restore.isPending}
                onClick={() => restore.mutate(v.id)}
                className="flex-none"
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
