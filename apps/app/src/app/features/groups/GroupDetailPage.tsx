import {
  Button,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { DocumentsList } from '../documents/DocumentsList';
import { AddDocsToCurrentGroupDialog } from './AddToGroupDialog';
import {
  GroupSearchView,
  GroupSummaryView,
} from './GroupIntelligencePanel';
import { useDeleteGroup, useGroup, usePatchGroup } from './queries';

type GroupTab = 'documents' | 'search' | 'summary';

export function GroupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { data: group, isLoading } = useGroup(id);
  const patch = usePatchGroup();
  const del = useDeleteGroup();

  const [tab, setTab] = useState<GroupTab>('documents');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [addOpen, setAddOpen] = useState(false);

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
          <Button size="sm" onClick={() => setAddOpen(true)}>
            {t('groups.addDocuments', '+ Add documents')}
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

      <AddDocsToCurrentGroupDialog
        groupId={group.id}
        existingDocIds={group.documents.map((d) => d.id)}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Tabs: Documents (table) · Search · Summary */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as GroupTab)}>
        <TabsList className="w-full max-w-md grid grid-cols-3">
          <TabsTrigger value="documents">
            {t('groups.tab.documents', 'Documents')}
            <span className="ml-1.5 text-[10px] text-foreground/45">
              {group.documents.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="search">
            {t('groups.tab.search', 'Search')}
          </TabsTrigger>
          <TabsTrigger value="summary">
            {t('groups.tab.summary', 'Summary')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <DocumentsList groupId={group.id} />
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <GroupSearchView
              groupId={group.id}
              documentCount={group.documents.length}
            />
          </div>
        </TabsContent>

        <TabsContent value="summary" className="mt-4">
          <div className="rounded-xl border border-border bg-background p-4">
            <GroupSummaryView
              groupId={group.id}
              documentCount={group.documents.length}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
