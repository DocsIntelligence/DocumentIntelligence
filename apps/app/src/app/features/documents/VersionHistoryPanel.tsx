import { Button } from '@org/ui';
import { useTranslation } from 'react-i18next';
import {
  useDocumentVersions,
  useRestoreVersion,
  useSnapshotDocument,
} from './queries';

/**
 * Headerless version-history list for inline mounting in a side panel.
 * The dialog variant wraps this with a Dialog header — logic identical.
 */
export function VersionHistoryPanel({
  documentId,
  enabled = true,
}: {
  documentId: string;
  /** When false, skips the list query (useful when mounted but hidden). */
  enabled?: boolean;
}) {
  const { t } = useTranslation();
  const versions = useDocumentVersions(documentId, enabled);
  const snapshot = useSnapshotDocument(documentId);
  const restore = useRestoreVersion(documentId);
  const items = versions.data ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs text-foreground/55">
          {t('versions.count', '{{count}} version', { count: items.length })}
        </span>
        <Button
          size="sm"
          variant="outline"
          isLoading={snapshot.isPending}
          onClick={() =>
            snapshot.mutate(t('versions.manualSave', 'Manual save'))
          }
        >
          {t('versions.saveCurrent', 'Save current')}
        </Button>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {versions.isLoading && (
          <p className="text-sm text-foreground/55">
            {t('common.loading', 'Loading…')}
          </p>
        )}
        {!versions.isLoading && items.length === 0 && (
          <p className="py-6 text-center text-sm text-foreground/55">
            {t(
              'versions.empty',
              'No versions yet. Save one above, or they accrue as you restore.',
            )}
          </p>
        )}
        {items.map((v) => (
          <div
            key={v.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {v.label || t('versions.snapshot', 'Snapshot')}
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
              {t('versions.restore', 'Restore')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
