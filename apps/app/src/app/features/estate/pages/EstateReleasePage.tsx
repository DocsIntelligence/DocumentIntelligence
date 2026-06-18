import { Badge, Button, Card, Spinner } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';
import { useCheckIn, useGrants, useRevokeGrant } from '../queries';

const STATUS_VARIANT: Record<string, 'secondary' | 'info' | 'warning' | 'success'> = {
  active: 'success',
  pinged: 'warning',
  escalated: 'warning',
  released: 'info',
  revoked: 'secondary',
};

/** Release / dead-man-switch control (docs/13 §1.2). Owner checks in to stay
 *  alive; shows each nominee's grant status. Release itself is human-verified. */
export function EstateReleasePage() {
  const { t } = useTranslation();
  const { data: grants, isLoading } = useGrants();
  const checkIn = useCheckIn();
  const revoke = useRevokeGrant();

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('estate.release', 'Release & check-in')}
        subtitle={t(
          'estate.releaseSubtitle',
          'Check in periodically. If you stop, your nominees are flagged for review and — after verification — granted access.',
        )}
        backTo="/estate"
      />

      <Card className="flex items-center justify-between gap-3 p-5">
        <p className="text-sm text-foreground/70">
          {t('estate.checkInPrompt', 'Confirm you still manage this vault.')}
        </p>
        <Button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
          {checkIn.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('estate.checkInNow', "I'm here — check in")}
        </Button>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y divide-border/60 p-0">
          {(grants ?? []).length === 0 && (
            <p className="p-5 text-sm text-foreground/60">
              {t('estate.noGrants', 'Add a nominee to set up release.')}
            </p>
          )}
          {(grants ?? []).map((g) => (
            <div key={g.id} className="space-y-1 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {g.nominee.name}
                  </span>
                  <Badge variant={STATUS_VARIANT[g.status] ?? 'secondary'}>
                    {g.status}
                  </Badge>
                </div>
                {g.status !== 'released' && g.status !== 'revoked' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke.mutate(g.nominee.id)}
                  >
                    {t('estate.revoke', 'Revoke')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-foreground/60">
                {t('estate.cadenceEvery', 'Checks in every {{n}} days', {
                  n: g.cadenceDays,
                })}{' '}
                ·{' '}
                {t('estate.nextPing', 'next reminder {{d}}', {
                  d: new Date(g.nextPingAt).toLocaleDateString('en-IN'),
                })}
              </p>
              {g.status === 'released' && g.accessToken && (
                <p className="text-xs text-info">
                  {t('estate.nomineeLink', 'Nominee access link')}:{' '}
                  <code className="break-all">/n/{g.accessToken}</code>
                </p>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
