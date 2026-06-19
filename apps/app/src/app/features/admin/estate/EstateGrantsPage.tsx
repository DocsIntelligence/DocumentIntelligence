import type { AdminReleaseGrant } from '@org/api-client';
import { Badge, Button, Card, Spinner } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { PageHeader } from '../../../components/page-header';
import { useEstateService } from '../../documents/services-context';
import { useEstateAdminGrants, useReleaseGrant } from './queries';

const STATUS_TONE: Record<
  string,
  'secondary' | 'warning' | 'success' | 'info'
> = {
  active: 'secondary',
  pinged: 'warning',
  escalated: 'warning',
  released: 'success',
  revoked: 'secondary',
};

/**
 * Ops "verification UI" for the dead-man-switch (docs/13 §11.6). Lists every
 * release grant, surfaces submitted proof-of-death documents to review, and
 * exposes the human-verified Release action. Release is deliberately manual.
 */
export function EstateGrantsPage() {
  const { t: tt } = useTranslation();
  const confirm = useConfirm();
  const svc = useEstateService();
  const grants = useEstateAdminGrants();
  const release = useReleaseGrant();

  const viewProof = async (grantId: string, index: number) => {
    try {
      const { url } = await svc.adminProofUrl(grantId, index);
      window.open(url, '_blank', 'noopener');
    } catch {
      /* surfaced by the network layer */
    }
  };

  const onRelease = async (g: AdminReleaseGrant) => {
    const ok = await confirm({
      title: tt('estateGrants.releaseTitle', 'Release access to {{name}}?', {
        name: g.nominee.name,
      }),
      description: tt(
        'estateGrants.releaseDesc',
        'This unlocks the nominee’s read-only view of the owner’s assets. Do this only after verifying proof of death. It cannot be undone.',
      ),
      confirmLabel: tt('estateGrants.release', 'Release'),
      variant: 'destructive',
    });
    if (ok) release.mutate(g.id);
  };

  const rows = grants.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        backTo="/config/estate-vault"
        title={tt('estateGrants.title', 'Release grants')}
        subtitle={tt(
          'estateGrants.subtitle',
          'Verify proof of death and release a nominee’s access. Releases are manual — never automatic.',
        )}
      />

      {grants.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-foreground/60">
          {tt('estateGrants.empty', 'No release grants yet.')}
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((g) => (
            <Card key={g.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {g.nominee.name}
                  </span>
                  <Badge
                    variant={STATUS_TONE[g.status] ?? 'secondary'}
                    className="text-[10px]"
                  >
                    {g.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-foreground/55">
                  {g.nominee.email} ·{' '}
                  {tt('estateGrants.missed', 'missed {{n}}', {
                    n: g.missedCount,
                  })}
                  {' · '}
                  {tt('estateGrants.nextPing', 'next {{d}}', {
                    d: new Date(g.nextPingAt).toLocaleDateString('en-IN'),
                  })}
                </p>
                {g.proofs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.proofs.map((p) => (
                      <button
                        key={p.index}
                        type="button"
                        onClick={() => viewProof(g.id, p.index)}
                        className="inline-flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-0.5 text-[11px] hover:bg-secondary"
                        title={p.note ?? p.filename}
                      >
                        📎 {p.filename}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-none items-center gap-2">
                {g.status === 'released' ? (
                  <Badge variant="success" outline className="text-[10px]">
                    {tt('estateGrants.released', 'Released')}
                  </Badge>
                ) : g.status === 'revoked' ? (
                  <Badge variant="secondary" outline className="text-[10px]">
                    {tt('estateGrants.revoked', 'Revoked')}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="error"
                    disabled={release.isPending}
                    onClick={() => onRelease(g)}
                  >
                    {tt('estateGrants.release', 'Release')}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default EstateGrantsPage;
