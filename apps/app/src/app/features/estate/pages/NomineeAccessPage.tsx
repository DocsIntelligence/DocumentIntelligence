import { Button, Card, Input, Spinner } from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { AssetRegister } from '../components/AssetRegister';
import {
  useNomineeAccess,
  useNomineeProofStatus,
  useSubmitNomineeProof,
} from '../queries';

/** Public, token-guarded nominee view (docs/13 §1.2). Before release it shows a
 *  proof-of-death submission form; once released it reveals the scoped register. */
export function NomineeAccessPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const status = useNomineeProofStatus(token);
  const released = status.data?.released === true;
  const access = useNomineeAccess(token, released);
  const submit = useSubmitNomineeProof(token ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');

  if (status.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status.isError || !status.data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
        <Card className="p-6 text-center text-sm text-foreground/70">
          {t('estate.accessInvalid', 'This access link is not valid.')}
        </Card>
      </div>
    );
  }

  // Released → the full scoped register.
  if (released && access.data) {
    return (
      <div className="mx-auto space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t('estate.nomineeViewTitle', 'Estate records')}
          </h1>
          <p className="mt-1 text-foreground/60">
            {t(
              'estate.nomineeViewSubtitle',
              'For {{name}} — every asset on record and how to claim each. This grants access to find and claim, not ownership; ownership follows the will or succession law.',
              { name: access.data.nominee.name },
            )}
          </p>
        </div>
        <AssetRegister
          assets={access.data.assets}
          currency={access.data.currency}
          totalValue={access.data.totalValue}
        />
      </div>
    );
  }

  // Pre-release → status + proof-of-death submission.
  const onSubmit = async () => {
    if (!file) return;
    await submit.mutateAsync({ file, note: note.trim() || undefined });
    setFile(null);
    setNote('');
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('estate.nomineeAccessTitle', 'Wealth Vault access')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'estate.nomineeAccessIntro',
            'Hello {{name}}. The records are not released yet. If the owner has passed away, you can submit proof (e.g. a death certificate) below — it will be reviewed before any access is granted.',
            { name: status.data.nomineeName },
          )}
        </p>
      </div>

      <Card className="space-y-4 p-5">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">
            {t('estate.proofFile', 'Proof document (PDF or image)')}
          </label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground/70">
            {t('estate.proofNote', 'Note (optional)')}
          </label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground/55">
            {status.data.proofCount > 0
              ? t(
                  'estate.proofSubmittedCount',
                  '{{n}} document(s) already submitted',
                  {
                    n: status.data.proofCount,
                  },
                )
              : t('estate.proofNone', 'No documents submitted yet')}
          </span>
          <Button onClick={onSubmit} disabled={!file || submit.isPending}>
            {submit.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.submitProof', 'Submit proof')}
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-foreground/45">
        {t(
          'estate.proofDisclaimer',
          'Submitting a document does not grant access. A person reviews every request.',
        )}
      </p>
    </div>
  );
}
