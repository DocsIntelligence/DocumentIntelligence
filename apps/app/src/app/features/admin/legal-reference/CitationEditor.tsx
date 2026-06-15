import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Button,
  Card,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Textarea,
} from '@org/ui';
import { APP_ENV } from '../../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

interface CitationForm {
  id: string;
  act: string;
  actShort: string;
  section: string;
  title: string;
  summary: string;
  effectiveFrom: string;
  supersedes: string;
  confidence: 'high' | 'moderate' | 'low';
  verifyNote: string;
  externalUrl: string;
  jurisdiction: string;
  draftingTips: string;
  topics: string;
  appliesTo: string;
  commonlyPairedWith: string;
  isActive: boolean;
  isPublic: boolean;
}

const EMPTY: CitationForm = {
  id: '',
  act: '',
  actShort: '',
  section: '',
  title: '',
  summary: '',
  effectiveFrom: '',
  supersedes: '',
  confidence: 'moderate',
  verifyNote: '',
  externalUrl: '',
  jurisdiction: 'IN',
  draftingTips: '',
  topics: '',
  appliesTo: '',
  commonlyPairedWith: '',
  isActive: true,
  isPublic: true,
};

type Mode = 'new' | 'edit' | 'clone';

interface Props {
  mode: Mode;
}

/**
 * Single editor — new / edit / clone all use the same form, just with
 * different initial data + IDs. Renders the standard "Back / Save"
 * toolbar to match every other admin editor in the platform (lookups,
 * schemas, pipelines, vault).
 *
 * For `mode='edit'`, the id from the URL is read-only.
 * For `mode='clone'`, the id is reset to `${original}_copy` and the user
 * picks a new one before saving.
 * For `mode='new'`, all fields are blank; user types the id.
 */
export function CitationEditor({ mode }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();

  const [form, setForm] = useState<CitationForm>({ ...EMPTY });
  const [loading, setLoading] = useState(mode !== 'new');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // ── Hydration ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'new') return;
    if (!paramId) {
      navigate('/config/legal-reference', { replace: true });
      return;
    }
    setLoading(true);
    fetch(
      `${API_BASE_URL}/legal-ai/admin/citations/${encodeURIComponent(paramId)}`,
      { credentials: 'include' },
    )
      .then((r) => r.json())
      .then((c) => {
        if (!c || !c.id) {
          toast.error(t('legalRefs.notFound', 'Citation not found'));
          navigate('/config/legal-reference', { replace: true });
          return;
        }
        const base: CitationForm = {
          id: mode === 'clone' ? `${c.id}_copy` : c.id,
          act: c.act ?? '',
          actShort: c.actShort ?? '',
          section: c.section ?? '',
          title: c.title ?? '',
          summary: c.summary ?? '',
          effectiveFrom: c.effectiveFrom ?? '',
          supersedes: c.supersedes ?? '',
          confidence: c.confidence ?? 'moderate',
          verifyNote: c.verifyNote ?? '',
          externalUrl: c.externalUrl ?? '',
          jurisdiction: c.jurisdiction ?? 'IN',
          draftingTips: c.draftingTips ?? '',
          topics: (c.topics ?? []).join(', '),
          appliesTo: (c.appliesTo ?? []).join(', '),
          commonlyPairedWith: (c.commonlyPairedWith ?? []).join(', '),
          isActive: true,
          isPublic: true,
        };
        setForm(base);
      })
      .catch(() => {
        toast.error(t('legalRefs.loadFailed', 'Failed to load citation'));
        navigate('/config/legal-reference', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [mode, paramId, navigate, t]);

  const patch = <K extends keyof CitationForm>(k: K, v: CitationForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const goBack = () => navigate('/config/legal-reference');

  const save = async () => {
    if (!form.id.trim()) {
      toast.error(
        t('legalRefs.idRequired', 'Citation id (e.g. ni.138) is required'),
      );
      return;
    }
    if (!form.act.trim() || !form.title.trim()) {
      toast.error(t('legalRefs.actTitleRequired', 'Act + title are required'));
      return;
    }
    setSaving(true);
    try {
      const body = {
        id: form.id.trim(),
        act: form.act.trim(),
        actShort: form.actShort.trim() || undefined,
        section: form.section.trim() || undefined,
        title: form.title.trim(),
        summary: form.summary.trim(),
        effectiveFrom: form.effectiveFrom.trim() || undefined,
        supersedes: form.supersedes.trim() || undefined,
        confidence: form.confidence,
        verifyNote: form.verifyNote.trim() || undefined,
        externalUrl: form.externalUrl.trim() || undefined,
        jurisdiction: form.jurisdiction.trim() || 'IN',
        draftingTips: form.draftingTips.trim() || undefined,
        topics: splitCsv(form.topics),
        appliesTo: splitCsv(form.appliesTo),
        commonlyPairedWith: splitCsv(form.commonlyPairedWith),
      };
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/admin/citations/${encodeURIComponent(body.id)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(t('legalRefs.saved', 'Citation saved'));
      navigate('/config/legal-reference');
    } catch (err) {
      toast.error(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const syncFromSource = async () => {
    if (!form.id || !form.section) {
      toast.info(
        t(
          'legalRefs.syncNoSection',
          'Save the citation with a section number first, then sync.',
        ),
      );
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/admin/citations/${encodeURIComponent(form.id)}/sync`,
        { method: 'POST', credentials: 'include' },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? JSON.stringify(body));
      toast.success(
        t(
          'legalRefs.syncedFromSource',
          'Pulled {{bytes}} chars from {{host}}',
          { bytes: body.bytes, host: new URL(body.sourceUrl).hostname },
        ),
      );
      // Re-hydrate to show the new summary / drafting tips.
      if (body.summary) patch('summary', body.summary);
      if (body.draftingTips) patch('draftingTips', body.draftingTips);
      if (body.sourceUrl) patch('externalUrl', body.sourceUrl);
    } catch (err) {
      toast.error(`Sync failed: ${(err as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar — mirrors every other admin editor */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5">
        <Button variant="ghost" size="sm" onClick={goBack}>
          ← {t('legalRefs.backTo', 'Back to citations')}
        </Button>
        <div className="flex items-center gap-2">
          {mode === 'edit' && form.section && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncFromSource}
              disabled={syncing}
            >
              {syncing ? (
                <Spinner className="size-3.5" />
              ) : (
                t('legalRefs.syncFromSource', 'Sync from indiacode')
              )}
            </Button>
          )}
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner className="size-3.5" /> : t('common.save', 'Save')}
          </Button>
        </div>
      </div>

      <Card className="rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('legalRefs.field.id', 'ID (e.g. ni.138)')}>
            <Input
              value={form.id}
              disabled={mode === 'edit'}
              onChange={(e) => patch('id', e.target.value)}
              placeholder="ni.138"
            />
          </Field>
          <Field label={t('legalRefs.field.jurisdiction', 'Jurisdiction')}>
            <Input
              value={form.jurisdiction}
              onChange={(e) => patch('jurisdiction', e.target.value)}
            />
          </Field>
          <Field label={t('legalRefs.field.act', 'Act (full)')}>
            <Input
              value={form.act}
              onChange={(e) => patch('act', e.target.value)}
              placeholder="Negotiable Instruments Act, 1881"
            />
          </Field>
          <Field label={t('legalRefs.field.actShort', 'Act (short)')}>
            <Input
              value={form.actShort}
              onChange={(e) => patch('actShort', e.target.value)}
              placeholder="NI Act"
            />
          </Field>
          <Field label={t('legalRefs.field.section', 'Section')}>
            <Input
              value={form.section}
              onChange={(e) => patch('section', e.target.value)}
              placeholder="138"
            />
          </Field>
          <Field label={t('legalRefs.field.confidence', 'Confidence')}>
            <Select
              value={form.confidence}
              onValueChange={(v) =>
                patch('confidence', v as CitationForm['confidence'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">high</SelectItem>
                <SelectItem value="moderate">moderate</SelectItem>
                <SelectItem value="low">low</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={t(
              'legalRefs.field.effectiveFrom',
              'Effective from (yyyy-mm-dd)',
            )}
          >
            <Input
              value={form.effectiveFrom}
              onChange={(e) => patch('effectiveFrom', e.target.value)}
              placeholder="2024-07-01"
            />
          </Field>
          <Field
            label={t(
              'legalRefs.field.supersedes',
              'Supersedes (e.g. crpc.200)',
            )}
          >
            <Input
              value={form.supersedes}
              onChange={(e) => patch('supersedes', e.target.value)}
            />
          </Field>
          <Field label={t('legalRefs.field.externalUrl', 'External URL')}>
            <Input
              value={form.externalUrl}
              onChange={(e) => patch('externalUrl', e.target.value)}
              placeholder="https://www.indiacode.nic.in/..."
            />
          </Field>
        </div>

        <Field label={t('legalRefs.field.title', 'Title')}>
          <Input
            value={form.title}
            onChange={(e) => patch('title', e.target.value)}
          />
        </Field>
        <Field label={t('legalRefs.field.summary', 'Summary (2–3 paragraphs)')}>
          <Textarea
            rows={4}
            value={form.summary}
            onChange={(e) => patch('summary', e.target.value)}
          />
        </Field>
        <Field
          label={t(
            'legalRefs.field.verifyNote',
            'Verify note (shown alongside the citation)',
          )}
        >
          <Input
            value={form.verifyNote}
            onChange={(e) => patch('verifyNote', e.target.value)}
          />
        </Field>
        <Field
          label={t(
            'legalRefs.field.draftingTips',
            'Drafting tips (markdown — surfaced on the public page)',
          )}
        >
          <Textarea
            rows={6}
            value={form.draftingTips}
            onChange={(e) => patch('draftingTips', e.target.value)}
            className="font-mono text-xs"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field
            label={t('legalRefs.field.topics', 'Topics (comma-separated)')}
          >
            <Input
              value={form.topics}
              onChange={(e) => patch('topics', e.target.value)}
              placeholder="cheque-bounce, criminal"
            />
          </Field>
          <Field
            label={t(
              'legalRefs.field.appliesTo',
              'Applies to doc types',
            )}
          >
            <Input
              value={form.appliesTo}
              onChange={(e) => patch('appliesTo', e.target.value)}
              placeholder="legal_notice"
            />
          </Field>
          <Field
            label={t(
              'legalRefs.field.commonlyPairedWith',
              'Commonly paired with',
            )}
          >
            <Input
              value={form.commonlyPairedWith}
              onChange={(e) => patch('commonlyPairedWith', e.target.value)}
              placeholder="ni.141, ni.142"
            />
          </Field>
        </div>
      </Card>

      <Card className="rounded-xl p-6 space-y-3">
        <h4 className="text-sm font-medium text-foreground">
          {t('legalRefs.visibility', 'Visibility')}
        </h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">
              {t('legalRefs.activeLabel', 'Active')}
            </p>
            <p className="text-xs text-foreground/50">
              {t(
                'legalRefs.activeHint',
                'When off, the citation is hidden from drafting auto-fill + the public catalog.',
              )}
            </p>
          </div>
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => patch('isActive', v)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">
              {t('legalRefs.publicLabel', 'Public')}
            </p>
            <p className="text-xs text-foreground/50">
              {t(
                'legalRefs.publicHint',
                'Show on the public /law catalog. Turn off for internal-only references.',
              )}
            </p>
          </div>
          <Switch
            checked={form.isPublic}
            onCheckedChange={(v) => patch('isPublic', v)}
          />
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function splitCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}
