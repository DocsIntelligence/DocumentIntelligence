import { Button, Input } from '@org/ui';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { DocumentsList } from '../documents/DocumentsList';
import { GroupIntelligencePanel } from './GroupIntelligencePanel';
import { useDeleteGroup, useGroup, usePatchGroup } from './queries';

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: group, isLoading } = useGroup(id);
  const patch = usePatchGroup();
  const del = useDeleteGroup();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary/40" />
        <div className="h-64 animate-pulse rounded-xl bg-secondary/40" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-8 text-sm text-foreground/60">
        {t('groups.notFound', 'Group not found.')}
      </div>
    );
  }

  const startRename = () => {
    setEditName(group.name);
    setEditing(true);
  };

  const saveRename = () => {
    if (editName.trim() && editName.trim() !== group.name) {
      patch.mutate({ id: group.id, payload: { name: editName.trim() } });
    }
    setEditing(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('groups.deleteTitle', 'Delete group'),
      description: t(
        'groups.deleteDesc',
        'Documents inside will be ungrouped, not deleted.',
      ),
    });
    if (ok) {
      del.mutate(group.id, { onSuccess: () => navigate('/groups') });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-foreground/50">
            <Link to="/groups" className="hover:text-foreground">
              {t('groups.title', 'Groups')}
            </Link>
            <span>/</span>
          </div>
          {editing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="mt-1 text-2xl font-semibold"
              autoFocus
            />
          ) : (
            <h2
              className="mt-1 text-2xl font-semibold cursor-pointer hover:text-primary/80"
              onClick={startRename}
              title={t('groups.clickToRename', 'Click to rename')}
            >
              {group.kind === 'bundle'
                ? '📦'
                : group.kind === 'matter'
                  ? '⚖️'
                  : '📁'}{' '}
              {group.name}
            </h2>
          )}
          <p className="mt-1 text-xs text-foreground/50">
            {group.kind} · {group.documents.length} document
            {group.documents.length !== 1 ? 's' : ''} · Created{' '}
            {new Date(group.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" asChild>
            <Link to={`/groups/${group.id}/add`}>
              {t('groups.addDocuments', '+ Add documents')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={startRename}>
            {t('common.rename', 'Rename')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-error"
            onClick={handleDelete}
          >
            {t('common.delete', 'Delete')}
          </Button>
        </div>
      </div>

      <GroupIntelligencePanel
        groupId={group.id}
        documentCount={group.documents.length}
      />

      {/* Reuse the full DocumentsList with server-side groupId filter */}
      <DocumentsList groupId={group.id} />
    </div>
  );
}
