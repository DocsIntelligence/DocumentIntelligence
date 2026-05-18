import { Button, Card } from '@org/ui';
import { Link } from 'react-router-dom';
import { useDocumentList } from './queries';

export function DocumentsList() {
  const { data, isLoading, error } = useDocumentList();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">My documents</h2>
          <p className="text-foreground/60 mt-1">
            Drafts, signed copies, and shared documents.
          </p>
        </div>
        <Button asChild>
          <Link to="/documents/new">New document</Link>
        </Button>
      </div>

      {isLoading && <p className="text-sm text-foreground/60">Loading…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Could not load documents. Try again.
        </p>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <Card className="rounded-xl p-8 text-center">
          <p className="text-foreground/70">
            No documents yet. Start with a rent agreement, an RTI, or a legal
            notice.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to="/documents/new">Create your first document</Link>
            </Button>
          </div>
        </Card>
      )}

      {(data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.map((d) => (
            <Card key={d.id} className="rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground/50 uppercase tracking-wide">
                  {d.documentType?.name ?? d.documentTypeId}
                </span>
                <span className="text-[10px] font-medium uppercase tracking-wide bg-foreground/5 px-2 py-0.5 rounded-full">
                  {d.status}
                </span>
              </div>
              <Link
                to={`/documents/${d.id}/edit`}
                className="block font-semibold text-foreground hover:underline"
              >
                {d.title || 'Untitled'}
              </Link>
              <p className="text-xs text-foreground/50">
                {d.template?.name ?? '—'} · {d.pageSize.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-foreground/40">
                Updated {new Date(d.updatedAt).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
