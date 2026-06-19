import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/page-header';
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
    <div className="space-y-6">
      <PageHeader
        backTo={`/groups/${group.id}`}
        title={`${t('groups.addDocsTitle', 'Add documents to')} ${group.name}`}
        subtitle={t(
          'groups.addDocsDesc',
          'Select documents below and click "Add" to include them in this group.',
        )}
      />

      <DocumentsList
        selectable
        onSelectionConfirm={handleConfirm}
        excludeIds={existingDocIds}
      />
    </div>
  );
}
