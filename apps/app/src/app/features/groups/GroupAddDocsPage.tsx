import { Button } from '@org/ui';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DocumentsList } from '../documents/DocumentsList';
import { useAddDocumentsToGroup, useGroup } from './queries';

/**
 * Full-page document picker for adding docs to a group.
 * Reuses DocumentsList in selectable mode with server-side pagination/search.
 */
export function GroupAddDocsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: group, isLoading } = useGroup(id);
  const addDocs = useAddDocumentsToGroup();

  if (isLoading || !group) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary/40" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary/40" />
      </div>
    );
  }

  const existingDocIds = group.documents.map((d: { id: string }) => d.id);

  const handleConfirm = (documentIds: string[]) => {
    addDocs.mutate(
      { groupId: group.id, documentIds },
      { onSuccess: () => navigate(`/groups/${group.id}`) },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-foreground/50">
            <Link to="/groups" className="hover:text-foreground">
              {t('groups.title', 'Groups')}
            </Link>
            <span>/</span>
            <Link to={`/groups/${group.id}`} className="hover:text-foreground">
              {group.name}
            </Link>
            <span>/</span>
            <span className="text-foreground">
              {t('groups.addDocuments', 'Add documents')}
            </span>
          </div>
          <h2 className="mt-1 text-xl font-semibold">
            {t('groups.addDocsTitle', 'Add documents to')} {group.name}
          </h2>
          <p className="mt-0.5 text-sm text-foreground/60">
            {t(
              'groups.addDocsDesc',
              'Select documents below and click "Add" to include them in this group.',
            )}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/groups/${group.id}`}>{t('common.back', 'Back')}</Link>
        </Button>
      </div>

      <DocumentsList
        selectable
        onSelectionConfirm={handleConfirm}
        excludeIds={existingDocIds}
      />
    </div>
  );
}
