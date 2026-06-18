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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/page-header';
import { useActiveProfile } from '../profile-context';
import { useVaultEntities } from '../../vault/queries';
import {
  useCreateProfile,
  useEstateProfiles,
  useProfileAccess,
  useRemoveProfile,
  useShareProfile,
  useUnshareProfile,
} from '../queries';

type Mode = 'new' | 'existing';

const BLANK = {
  label: '',
  name: '',
  dob: '',
  phone: '',
  aadhaar: '',
  pan: '',
  address: '',
  vaultEntityId: '',
};

/**
 * Manage the person-vaults this account owns or has access to (docs/15). Each
 * profile is backed by a Vault PERSON profile; estate data (assets, nominees,
 * net worth, release plan) is scoped to the profile, not the acting user. Owners
 * can share a profile with another registered account (e.g. a wealth manager, or
 * the original person) as manager or viewer.
 */
export function EstateProfilesPage() {
  const { t } = useTranslation();
  const { data: profiles, isLoading } = useEstateProfiles();
  const { activeProfileId, setActiveProfile } = useActiveProfile();
  const create = useCreateProfile();
  const remove = useRemoveProfile();
  const { data: vaultList } = useVaultEntities({ pageSize: 100 });

  const [mode, setMode] = useState<Mode>('new');
  const [f, setF] = useState({ ...BLANK });
  const set = (patch: Partial<typeof BLANK>) =>
    setF((prev) => ({ ...prev, ...patch }));
  const [sharingId, setSharingId] = useState<string | null>(null);

  const entityOptions = vaultList?.items ?? [];
  const linkedEntity = entityOptions.find((e) => e.id === f.vaultEntityId);

  const canAdd =
    (mode === 'new' ? !!f.name.trim() : !!f.vaultEntityId) && !create.isPending;

  const add = async () => {
    if (!canAdd) return;
    if (mode === 'existing') {
      await create.mutateAsync({
        vaultEntityId: f.vaultEntityId,
        label: f.label.trim() || undefined,
      });
    } else {
      await create.mutateAsync({
        label: f.label.trim() || undefined,
        name: f.name.trim(),
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
        title={t('estate.profilesTitle', 'Profiles')}
        subtitle={t(
          'estate.profilesSubtitle',
          'Each profile is a separate person-vault — yourself, a spouse, or a client. Switch between them from the bar above; share a profile to let someone else manage or view it.',
        )}
        backTo="/estate"
      />

      {/* Add a profile */}
      <Card className="space-y-4 p-5">
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
          <FormField
            label={t('estate.profileLabel', 'Profile label')}
            hint={t('estate.profileLabelHint', 'Optional — e.g. “Spouse — Priya”')}
            className="sm:col-span-2"
          >
            <Input
              value={f.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder={t('estate.profileLabelPh', 'Spouse, Mother, Client name…')}
            />
          </FormField>

          {mode === 'existing' ? (
            <FormField
              label={t('estate.vaultPerson', 'Vault person')}
              hint={t(
                'estate.vaultPersonHint',
                'KYC + documents come from this profile',
              )}
              className="sm:col-span-2"
            >
              <Select
                value={f.vaultEntityId || undefined}
                onValueChange={(v) => {
                  const ent = entityOptions.find((e) => e.id === v);
                  set({ vaultEntityId: v, label: f.label || (ent?.label ?? '') });
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('estate.pickPerson', 'Select a Vault profile…')}
                  />
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
          ) : (
            <>
              <FormField label={t('estate.personName', 'Name')}>
                <Input
                  value={f.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </FormField>
              <FormField label={t('estate.dob', 'Date of birth')}>
                <Input
                  type="date"
                  value={f.dob}
                  onChange={(e) => set({ dob: e.target.value })}
                />
              </FormField>
              <FormField label={t('estate.phone', 'Phone')}>
                <Input
                  value={f.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              </FormField>
              <FormField
                label={t('estate.aadhaar', 'Aadhaar')}
                hint={t('estate.vaultEncHint', 'Stored in the Vault profile, encrypted')}
              >
                <Input
                  value={f.aadhaar}
                  onChange={(e) => set({ aadhaar: e.target.value })}
                  placeholder="1234 5678 9012"
                />
              </FormField>
              <FormField
                label={t('estate.pan', 'PAN')}
                hint={t('estate.vaultEncHint', 'Stored in the Vault profile, encrypted')}
              >
                <Input
                  value={f.pan}
                  onChange={(e) => set({ pan: e.target.value })}
                  placeholder="ABCDE1234F"
                />
              </FormField>
              <FormField
                label={t('estate.address', 'Address')}
                className="sm:col-span-2"
              >
                <Input
                  value={f.address}
                  onChange={(e) => set({ address: e.target.value })}
                />
              </FormField>
            </>
          )}

          {mode === 'existing' && linkedEntity && (
            <p className="text-xs text-foreground/55 sm:col-span-2">
              {t(
                'estate.linkedProfileNote',
                'This profile reuses the linked Vault person for KYC and documents.',
              )}{' '}
              <Link
                to={`/vault/${linkedEntity.id}`}
                className="text-primary hover:underline"
              >
                {t('estate.openProfile', 'Open profile')}
              </Link>
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button onClick={add} disabled={!canAdd}>
            {create.isPending && <Spinner className="mr-2 h-4 w-4" />}
            {t('estate.addProfile', 'Add profile')}
          </Button>
        </div>
      </Card>

      {/* Existing profiles */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y divide-border/60 p-0">
          {(profiles ?? []).length === 0 && (
            <p className="p-5 text-sm text-foreground/60">
              {t('estate.noProfiles', 'No profiles yet.')}
            </p>
          )}
          {(profiles ?? []).map((p) => (
            <div key={p.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    {p.label}
                    {p.isSelf && (
                      <Badge variant="secondary" outline className="text-[10px]">
                        {t('estate.you', 'You')}
                      </Badge>
                    )}
                    {!p.isSelf && (
                      <Badge variant="secondary" outline className="text-[10px]">
                        {p.role}
                      </Badge>
                    )}
                  </p>
                </div>
                <div className="flex flex-none items-center gap-1">
                  {p.id === activeProfileId ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {t('estate.active', 'Active')}
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveProfile(p.id)}
                    >
                      {t('estate.switchTo', 'Switch to')}
                    </Button>
                  )}
                  {p.role === 'owner' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSharingId((cur) => (cur === p.id ? null : p.id))
                      }
                    >
                      {t('estate.share', 'Share')}
                    </Button>
                  )}
                  {p.role === 'owner' && !p.isSelf && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove.mutate(p.id)}
                      disabled={remove.isPending}
                    >
                      {t('common.delete', 'Delete')}
                    </Button>
                  )}
                </div>
              </div>
              {sharingId === p.id && p.role === 'owner' && (
                <SharePanel profileId={p.id} />
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/** Inline access manager for one owned profile: list who has access + add/remove. */
function SharePanel({ profileId }: { profileId: string }) {
  const { t } = useTranslation();
  const { data: access, isLoading } = useProfileAccess(profileId);
  const share = useShareProfile(profileId);
  const unshare = useUnshareProfile(profileId);

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'viewer'>('manager');

  const canShare = !!email.trim() && !share.isPending;
  const submit = async () => {
    if (!canShare) return;
    await share.mutateAsync({ email: email.trim(), role });
    setEmail('');
  };

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border/60 bg-muted/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/45">
        {t('estate.sharedWith', 'Shared with')}
      </p>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Spinner className="h-4 w-4" />
        </div>
      ) : (access ?? []).length === 0 ? (
        <p className="text-sm text-foreground/55">
          {t('estate.notShared', 'Not shared with anyone yet.')}
        </p>
      ) : (
        <div className="space-y-1">
          {(access ?? []).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-foreground/80">
                {row.name ? `${row.name} · ` : ''}
                {row.email ?? row.userId}
                <Badge variant="secondary" outline className="ml-2 text-[10px]">
                  {row.role}
                </Badge>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unshare.mutate(row.userId)}
                disabled={unshare.isPending}
              >
                {t('estate.removeAccess', 'Remove')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <FormField
          label={t('estate.shareEmail', 'Account email')}
          className="flex-1"
        >
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
        </FormField>
        <FormField label={t('estate.shareRole', 'Role')} className="sm:w-40">
          <Select value={role} onValueChange={(v) => setRole(v as 'manager' | 'viewer')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manager">
                {t('estate.roleManager', 'Manager')}
              </SelectItem>
              <SelectItem value="viewer">
                {t('estate.roleViewer', 'Viewer')}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <Button onClick={submit} disabled={!canShare}>
          {share.isPending && <Spinner className="mr-2 h-4 w-4" />}
          {t('estate.shareAction', 'Share')}
        </Button>
      </div>
      <p className="text-xs text-foreground/45">
        {t(
          'estate.shareHint',
          'The person must already have an account. Managers can edit; viewers can only read.',
        )}
      </p>
    </div>
  );
}
