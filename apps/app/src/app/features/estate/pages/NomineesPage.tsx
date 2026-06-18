import { RELATIONSHIP_OPTIONS } from '@org/dto';
import {
  Badge,
  Button,
  Card,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/page-header';
import { useLookupOptions } from '../../documents/queries';
import { useVaultEntities } from '../../vault/queries';
import { useCreateNominee, useDeleteNominee, useNominees } from '../queries';

type Mode = 'new' | 'existing';

const BLANK = {
  name: '',
  email: '',
  relationship: '',
  dob: '',
  phone: '',
  aadhaar: '',
  pan: '',
  address: '',
  vaultEntityId: '',
};

/** Manage the people who can find/claim assets after release (docs/13 §9).
 *  A nominee is a custodian, NOT the legal heir — pair with a will.
 *
 *  Every nominee is backed by a Vault PERSON profile (the source of truth for
 *  DOB / Aadhaar / PAN / phone / address + documents): either link an existing
 *  Vault person, or create one inline from this form. No KYC is duplicated. */
export function NomineesPage() {
  const { t } = useTranslation();
  const { data: nominees, isLoading } = useNominees();
  const create = useCreateNominee();
  const del = useDeleteNominee();
  const { data: lookups } = useLookupOptions();
  const { data: vaultList } = useVaultEntities({ pageSize: 100 });

  const [mode, setMode] = useState<Mode>('new');
  const [f, setF] = useState({ ...BLANK });
  const set = (patch: Partial<typeof BLANK>) =>
    setF((prev) => ({ ...prev, ...patch }));

  const relationshipOptions = useMemo(() => {
    const fromLookup = (lookups?.['relationship'] ?? []).map((o) => o.label);
    return fromLookup.length ? fromLookup : [...RELATIONSHIP_OPTIONS];
  }, [lookups]);

  const entityOptions = vaultList?.items ?? [];
  const linkedEntity = entityOptions.find((e) => e.id === f.vaultEntityId);

  const canAdd =
    !!f.name.trim() &&
    !!f.email.trim() &&
    (mode === 'new' || !!f.vaultEntityId) &&
    !create.isPending;

  const add = async () => {
    if (!canAdd) return;
    const base = {
      name: f.name.trim(),
      email: f.email.trim(),
      relationship: f.relationship.trim() || undefined,
    };
    if (mode === 'existing') {
      await create.mutateAsync({ ...base, vaultEntityId: f.vaultEntityId });
    } else {
      await create.mutateAsync({
        ...base,
        dob: f.dob || undefined,
        phone: f.phone.trim() || undefined,
        aadhaar: f.aadhaar.trim() || undefined,
        pan: f.pan.trim().toUpperCase() || undefined,
        address: f.address.trim() || undefined,
      });
    }
    setF({ ...BLANK });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('estate.nominees', 'Nominees')}
        subtitle={t(
          'estate.nomineesSubtitle',
          'People who can find and claim your assets if access is released. A nominee receives custody, not ownership — pair this with a will. Each nominee is backed by a Vault profile.',
        )}
        backTo="/estate"
      />

      <Card className="space-y-4 p-5">
        {/* Source of the nominee's profile */}
        <div className="inline-flex rounded-md border border-border p-0.5 text-sm">
          {(['new', 'existing'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded px-3 py-1.5 font-medium transition-colors',
                mode === m
                  ? 'bg-secondary text-foreground'
                  : 'text-foreground/55 hover:text-foreground',
              )}
            >
              {m === 'new'
                ? t('estate.newPerson', 'New person')
                : t('estate.existingPerson', 'Link Vault person')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {mode === 'existing' && (
            <FormField
              label={t('estate.vaultPerson', 'Vault person')}
              hint={t('estate.vaultPersonHint', 'KYC + documents come from this profile')}
              className="sm:col-span-2"
            >
              <Select
                value={f.vaultEntityId || undefined}
                onValueChange={(v) => {
                  const ent = entityOptions.find((e) => e.id === v);
                  set({ vaultEntityId: v, name: f.name || (ent?.label ?? '') });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('estate.pickPerson', 'Select a Vault profile…')} />
                </SelectTrigger>
                <SelectContent>
                  {entityOptions.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.label} · {e.kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <FormField label={t('estate.nomineeName', 'Name')}>
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} />
          </FormField>
          <FormField label={t('estate.nomineeEmail', 'Email')} hint={t('estate.emailHint', 'Where the release invite is sent')}>
            <Input
              type="email"
              value={f.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </FormField>
          <FormField label={t('estate.relationship', 'Relationship')}>
            <Select
              value={f.relationship || undefined}
              onValueChange={(v) => set({ relationship: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('estate.relationshipPlaceholder', 'Select…')} />
              </SelectTrigger>
              <SelectContent>
                {relationshipOptions.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {mode === 'new' ? (
            <>
              <FormField label={t('estate.dob', 'Date of birth')}>
                <Input
                  type="date"
                  value={f.dob}
                  onChange={(e) => set({ dob: e.target.value })}
                />
              </FormField>
              <FormField label={t('estate.phone', 'Phone')}>
                <Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
              </FormField>
              <FormField label={t('estate.aadhaar', 'Aadhaar')} hint={t('estate.vaultEncHint', 'Stored in the Vault profile, encrypted')}>
                <Input
                  value={f.aadhaar}
                  onChange={(e) => set({ aadhaar: e.target.value })}
                  placeholder="1234 5678 9012"
                />
              </FormField>
              <FormField label={t('estate.pan', 'PAN')} hint={t('estate.vaultEncHint', 'Stored in the Vault profile, encrypted')}>
                <Input
                  value={f.pan}
                  onChange={(e) => set({ pan: e.target.value })}
                  placeholder="ABCDE1234F"
                />
              </FormField>
              <FormField label={t('estate.address', 'Address')} className="sm:col-span-2">
                <Input
                  value={f.address}
                  onChange={(e) => set({ address: e.target.value })}
                />
              </FormField>
            </>
          ) : (
            linkedEntity && (
              <p className="text-xs text-foreground/55 sm:col-span-2">
                {t(
                  'estate.linkedNote',
                  'KYC (DOB / Aadhaar / PAN / address) and documents are managed in the linked Vault profile.',
                )}{' '}
                <Link
                  to={`/vault/${linkedEntity.id}`}
                  className="text-primary hover:underline"
                >
                  {t('estate.openProfile', 'Open profile')}
                </Link>
              </p>
            )
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={!canAdd}>
            {create.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.addNominee', 'Add nominee')}
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y divide-border/60 p-0">
          {(nominees ?? []).length === 0 && (
            <p className="p-5 text-sm text-foreground/60">
              {t('estate.noNominees', 'No nominees yet.')}
            </p>
          )}
          {(nominees ?? []).map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-foreground">
                  {n.name}
                  {n.relationship && (
                    <Badge variant="secondary" outline className="text-[10px]">
                      {n.relationship}
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-foreground/60">
                  {[
                    n.email,
                    n.dob ? `DOB ${n.dob}` : null,
                    n.aadhaarMasked,
                    n.panMasked,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-none items-center gap-1">
                {n.vaultEntityId && (
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/vault/${n.vaultEntityId}`}>
                      {t('estate.vaultProfile', 'Vault profile')}
                    </Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => del.mutate(n.id)}
                  disabled={del.isPending}
                >
                  {t('common.delete', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
