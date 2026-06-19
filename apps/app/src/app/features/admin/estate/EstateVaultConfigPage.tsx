import type {
  AssetCategory,
  EstateConfigAssetType,
  EstateVaultConfig,
} from '@org/api-client';
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
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';
import { Link } from 'react-router-dom';
import { useConfirm } from '../../../components/confirm/ConfirmProvider';
import { IconButton, TrashIcon } from '../intelligence/icons';
import { useEstateAdminConfig, useUpdateEstateAdminConfig } from './queries';

const CATEGORIES: AssetCategory[] = ['financial', 'physical', 'other'];
const VALUATIONS = ['manual', 'spot_gold', 'circle_rate'] as const;

const VALUATION_LABEL: Record<string, string> = {
  manual: 'Manual',
  spot_gold: 'Gold (spot × grams)',
  circle_rate: 'Property (circle rate)',
};

/** Local shell — mirrors the other /config/* pages (title + subtitle + Card). */
function ConfigShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader back={false} title={title} subtitle={subtitle} />
      <Card className="rounded-xl p-6">{children}</Card>
    </div>
  );
}

/** A numeric config knob with a unit suffix + helper text. */
function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <FormField label={label} hint={hint}>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </FormField>
  );
}

/**
 * `/config/estate-vault` — admin editor for the Estate & Wealth Vault module
 * config-as-data (docs/13 §0.3): the kill switch, liveness/release cadence,
 * gap-nudge thresholds, sub-surface toggles, and the asset-type catalog.
 * Backed by `PUT /admin/estate-vault/config` (whole-config merge). Targets the
 * system defaults (no orgId) for now — open to any authenticated user, like the
 * other admin surfaces.
 */
export function EstateVaultConfigPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const query = useEstateAdminConfig();
  const update = useUpdateEstateAdminConfig();

  const [draft, setDraft] = useState<EstateVaultConfig | null>(null);
  // Keys present in the server config are locked (referenced by existing
  // assets); only freshly-added rows allow editing the stable key.
  const [lockedKeys, setLockedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (query.data) {
      setDraft(structuredClone(query.data));
      setLockedKeys(new Set(query.data.assetTypes.map((a) => a.key)));
    }
  }, [query.data]);

  if (query.isLoading || !draft) {
    return (
      <ConfigShell
        title={t('estateAdmin.title', 'Estate & Wealth Vault')}
        subtitle={t(
          'estateAdmin.subtitle',
          'Module settings, release cadence, and the asset-type catalog — no redeploy.',
        )}
      >
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      </ConfigShell>
    );
  }

  const patch = (p: Partial<EstateVaultConfig>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));
  const patchToggle = (key: keyof EstateVaultConfig['toggles'], v: boolean) =>
    setDraft((d) => (d ? { ...d, toggles: { ...d.toggles, [key]: v } } : d));
  const patchLegal = (p: Partial<EstateVaultConfig['legalReview']>) =>
    setDraft((d) => (d ? { ...d, legalReview: { ...d.legalReview, ...p } } : d));

  const patchType = (i: number, p: Partial<EstateConfigAssetType>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            assetTypes: d.assetTypes.map((t, idx) =>
              idx === i ? { ...t, ...p } : t,
            ),
          }
        : d,
    );

  const addType = () =>
    setDraft((d) =>
      d
        ? {
            ...d,
            assetTypes: [
              ...d.assetTypes,
              {
                key: '',
                label: '',
                category: 'financial',
                valuation: 'manual',
                sortOrder:
                  d.assetTypes.reduce((m, a) => Math.max(m, a.sortOrder), -1) +
                  1,
                isActive: true,
              },
            ],
          }
        : d,
    );

  const removeType = async (i: number) => {
    const row = draft.assetTypes[i];
    if (lockedKeys.has(row.key)) {
      const ok = await confirm({
        title: t('estateAdmin.removeTypeTitle', 'Remove this asset type?'),
        description: t(
          'estateAdmin.removeTypeDesc',
          'Existing assets of this type are kept, but the type will no longer be selectable when adding new ones. Prefer disabling it instead.',
        ),
        confirmLabel: t('common.remove', 'Remove'),
        variant: 'destructive',
      });
      if (!ok) return;
    }
    setDraft((d) =>
      d ? { ...d, assetTypes: d.assetTypes.filter((_, idx) => idx !== i) } : d,
    );
  };

  // Validation: every type needs a key + label; keys must be unique.
  const keys = draft.assetTypes.map((a) => a.key.trim());
  const hasBlank = draft.assetTypes.some(
    (a) => !a.key.trim() || !a.label.trim(),
  );
  const hasDupKey = new Set(keys).size !== keys.length;
  const canSave = !hasBlank && !hasDupKey && !update.isPending;

  const save = () => {
    if (!draft || !canSave) return;
    update.mutate(
      {
        ...draft,
        assetTypes: draft.assetTypes.map((a) => ({
          ...a,
          key: a.key.trim(),
          label: a.label.trim(),
        })),
      },
      {
        onSuccess: (cfg) =>
          setLockedKeys(new Set(cfg.assetTypes.map((a) => a.key))),
      },
    );
  };

  return (
    <ConfigShell
      title={t('estateAdmin.title', 'Estate & Wealth Vault')}
      subtitle={t(
        'estateAdmin.subtitle',
        'Module settings, release cadence, and the asset-type catalog — no redeploy.',
      )}
    >
      <div className="space-y-8">
        {/* Sticky save bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            {draft.enabled ? (
              <Badge variant="success">{t('estateAdmin.on', 'Enabled')}</Badge>
            ) : (
              <Badge variant="secondary">
                {t('estateAdmin.off', 'Disabled')}
              </Badge>
            )}
            <p className="text-xs text-foreground/55">
              {t(
                'estateAdmin.scopeNote',
                'System-wide defaults. The env kill switch (ESTATE_VAULT_ENABLED) overrides this at boot.',
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/config/estate-vault/grants">
                {t('estateAdmin.releaseGrants', 'Release grants')}
              </Link>
            </Button>
            {(hasBlank || hasDupKey) && (
              <span className="text-xs text-destructive">
                {hasDupKey
                  ? t('estateAdmin.dupKey', 'Asset-type keys must be unique.')
                  : t(
                      'estateAdmin.blankRow',
                      'Every asset type needs a key and label.',
                    )}
              </span>
            )}
            <Button onClick={save} disabled={!canSave}>
              {update.isPending && <Spinner className="mr-2 h-4 w-4" />}
              {t('common.save', 'Save')}
            </Button>
          </div>
        </div>

        {/* Module */}
        <section className="space-y-3">
          <SectionHeading
            title={t('estateAdmin.module', 'Module')}
            hint={t(
              'estateAdmin.moduleHint',
              'Turn the whole module on or off and set the reporting currency.',
            )}
          />
          <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
            <span className="font-medium">
              {t('estateAdmin.enabled', 'Module enabled')}
            </span>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(v) => patch({ enabled: v })}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t('estateAdmin.baseCurrency', 'Base currency')}>
              <Input
                value={draft.baseCurrency}
                maxLength={3}
                onChange={(e) =>
                  patch({ baseCurrency: e.target.value.toUpperCase() })
                }
                placeholder="INR"
              />
            </FormField>
            <NumberField
              label={t('estateAdmin.maxNominees', 'Max nominees per asset')}
              value={draft.maxNomineesPerAsset}
              min={1}
              max={4}
              onChange={(v) => patch({ maxNomineesPerAsset: v })}
            />
          </div>
        </section>

        {/* Liveness & release */}
        <section className="space-y-3">
          <SectionHeading
            title={t('estateAdmin.release', 'Liveness & release')}
            hint={t(
              'estateAdmin.releaseHint',
              'The dead-man-switch cadence: how often owners check in, how many missed pings before escalation, and the cooling-off window before a nominee can be released.',
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <NumberField
              label={t('estateAdmin.cadence', 'Check-in cadence')}
              hint={t('estateAdmin.days', 'days')}
              value={draft.livenessCadenceDays}
              min={1}
              max={365}
              onChange={(v) => patch({ livenessCadenceDays: v })}
            />
            <NumberField
              label={t('estateAdmin.missedPings', 'Missed pings to escalate')}
              value={draft.missedPingsBeforeEscalation}
              min={1}
              max={10}
              onChange={(v) => patch({ missedPingsBeforeEscalation: v })}
            />
            <NumberField
              label={t('estateAdmin.coolingOff', 'Cooling-off')}
              hint={t('estateAdmin.days', 'days')}
              value={draft.coolingOffDays}
              min={0}
              max={90}
              onChange={(v) => patch({ coolingOffDays: v })}
            />
          </div>
        </section>

        {/* Gap nudges */}
        <section className="space-y-3">
          <SectionHeading
            title={t('estateAdmin.nudges', 'Gap nudges')}
            hint={t(
              'estateAdmin.nudgesHint',
              'Thresholds for the "Things to review" prompts: when a valuation is considered stale and when an asset looks dormant.',
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <NumberField
              label={t('estateAdmin.freshness', 'Stale after')}
              hint={t('estateAdmin.days', 'days')}
              value={draft.freshnessThresholdDays}
              min={7}
              max={1095}
              onChange={(v) => patch({ freshnessThresholdDays: v })}
            />
            <NumberField
              label={t('estateAdmin.dormancy', 'Dormant after')}
              hint={t('estateAdmin.days', 'days')}
              value={draft.dormancyThresholdDays}
              min={30}
              max={1825}
              onChange={(v) => patch({ dormancyThresholdDays: v })}
            />
          </div>
        </section>

        {/* Surfaces */}
        <section className="space-y-3">
          <SectionHeading
            title={t('estateAdmin.surfaces', 'Surfaces')}
            hint={t(
              'estateAdmin.surfacesHint',
              'Toggle sub-features of the module independently of the master switch.',
            )}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ToggleRow
              label={t('estateAdmin.netWorth', 'Net-worth dashboard')}
              checked={draft.toggles.netWorthDashboard}
              onChange={(v) => patchToggle('netWorthDashboard', v)}
            />
            <ToggleRow
              label={t('estateAdmin.gapNudges', 'Gap nudges')}
              checked={draft.toggles.gapNudges}
              onChange={(v) => patchToggle('gapNudges', v)}
            />
            <ToggleRow
              label={t('estateAdmin.claimsConcierge', 'Claims concierge')}
              checked={draft.toggles.claimsConcierge}
              onChange={(v) => patchToggle('claimsConcierge', v)}
            />
            <ToggleRow
              label={t('estateAdmin.b2b2c', 'B2B2C distribution')}
              checked={draft.toggles.b2b2c}
              onChange={(v) => patchToggle('b2b2c', v)}
            />
          </div>
        </section>

        {/* Legal review — manual tracking entry (docs/13 D.2.6), no workflow. */}
        <section className="space-y-3">
          <SectionHeading
            title={t('estateAdmin.legalReview', 'Legal review')}
            hint={t(
              'estateAdmin.legalReviewHint',
              'The how-to-claim text and nominee≠heir copy need an Indian lawyer’s review before you rely on them. Track it here and follow up manually.',
            )}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t('estateAdmin.legalStatus', 'Status')}>
              <Select
                value={draft.legalReview.status}
                onValueChange={(v) =>
                  patchLegal({ status: v as EstateVaultConfig['legalReview']['status'] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">{t('estateAdmin.legalPending', 'Pending')}</SelectItem>
                  <SelectItem value="in_review">{t('estateAdmin.legalInReview', 'In review')}</SelectItem>
                  <SelectItem value="approved">{t('estateAdmin.legalApproved', 'Approved')}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t('estateAdmin.legalReviewer', 'Reviewer / firm')}>
              <Input
                value={draft.legalReview.reviewedBy}
                onChange={(e) => patchLegal({ reviewedBy: e.target.value })}
                placeholder={t('estateAdmin.legalReviewerPh', 'e.g. ABC Law LLP')}
              />
            </FormField>
            <FormField label={t('estateAdmin.legalNote', 'Notes')} className="sm:col-span-2">
              <Input
                value={draft.legalReview.note}
                onChange={(e) => patchLegal({ note: e.target.value })}
                placeholder={t('estateAdmin.legalNotePh', 'What was reviewed / what is pending')}
              />
            </FormField>
          </div>
        </section>

        {/* Asset types */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionHeading
              title={t('estateAdmin.assetTypes', 'Asset-type catalog')}
              hint={t(
                'estateAdmin.assetTypesHint',
                'What an asset can be. The key is stable (referenced by existing assets); disable rather than delete to keep history intact.',
              )}
            />
            <Button variant="outline" size="sm" onClick={addType}>
              {t('estateAdmin.addType', '+ Add asset type')}
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border border-border">
            <div className="hidden grid-cols-[1.4fr_1.4fr_1fr_1.2fr_0.6fr_auto] gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-foreground/45 sm:grid">
              <span>{t('estateAdmin.key', 'Key')}</span>
              <span>{t('estateAdmin.label', 'Label')}</span>
              <span>{t('estateAdmin.category', 'Category')}</span>
              <span>{t('estateAdmin.valuation', 'Valuation')}</span>
              <span>{t('estateAdmin.active', 'Active')}</span>
              <span />
            </div>
            <div className="divide-y divide-border/60">
              {draft.assetTypes.map((row, i) => {
                const locked = lockedKeys.has(row.key);
                return (
                  <div
                    key={i}
                    className={cn(
                      'grid grid-cols-2 items-center gap-2 px-3 py-2 sm:grid-cols-[1.4fr_1.4fr_1fr_1.2fr_0.6fr_auto]',
                      !row.isActive && 'opacity-60',
                    )}
                  >
                    <Input
                      value={row.key}
                      disabled={locked}
                      onChange={(e) =>
                        patchType(i, {
                          key: e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, '_'),
                        })
                      }
                      placeholder="bank"
                      className="h-8 font-mono text-xs"
                    />
                    <Input
                      value={row.label}
                      onChange={(e) => patchType(i, { label: e.target.value })}
                      placeholder={t('estateAdmin.labelPh', 'Bank account')}
                      className="h-8 text-sm"
                    />
                    <Select
                      value={row.category}
                      onValueChange={(v) =>
                        patchType(i, { category: v as AssetCategory })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={row.valuation}
                      onValueChange={(v) => patchType(i, { valuation: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VALUATIONS.map((v) => (
                          <SelectItem key={v} value={v}>
                            {VALUATION_LABEL[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between gap-1 sm:justify-start">
                      <span className="text-xs text-foreground/55 sm:hidden">
                        {t('estateAdmin.active', 'Active')}
                      </span>
                      <Switch
                        checked={row.isActive}
                        onCheckedChange={(v) => patchType(i, { isActive: v })}
                      />
                    </div>
                    <div className="flex justify-end">
                      <IconButton
                        danger
                        title={t('common.remove', 'Remove')}
                        onClick={() => removeType(i)}
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
              {draft.assetTypes.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-foreground/55">
                  {t(
                    'estateAdmin.noTypes',
                    'No asset types. Add one to let users record assets.',
                  )}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </ConfigShell>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-0.5 text-xs text-foreground/55">{hint}</p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
      <span className="font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export default EstateVaultConfigPage;
