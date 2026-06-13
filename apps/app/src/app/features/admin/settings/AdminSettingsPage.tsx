import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Badge,
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

type SettingScope = 'system' | 'org' | 'user';

interface SettingDef {
  key: string;
  scope: SettingScope;
  default: unknown;
  label: string;
  description: string;
  type?: 'boolean' | 'number' | 'string' | 'json';
}

interface SettingRow {
  def: SettingDef;
  override?: { value: unknown; notes?: string | null };
  effective: unknown;
}

function inferType(def: SettingDef): 'boolean' | 'number' | 'string' | 'json' {
  if (def.type) return def.type;
  const d = def.default;
  if (typeof d === 'boolean') return 'boolean';
  if (typeof d === 'number') return 'number';
  if (typeof d === 'string') return 'string';
  return 'json';
}

export function AdminSettingsPage() {
  const { t } = useTranslation();

  const [scope, setScope] = useState<SettingScope>('system');
  const [scopeId, setScopeId] = useState<string>('');
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useMemo(
    () => () => {
      setLoading(true);
      const params = new URLSearchParams({ scope });
      if (scope !== 'system' && scopeId) params.set('scopeId', scopeId);
      fetch(`${API_BASE_URL}/admin/settings?${params.toString()}`, {
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((data: SettingRow[]) => setRows(data))
        .catch(() => toast.error(t('settings.loadFailed', 'Failed to load settings')))
        .finally(() => setLoading(false));
    },
    [scope, scopeId, t],
  );

  useEffect(() => {
    if (scope !== 'system' && !scopeId) {
      setRows([]);
      setLoading(false);
      return;
    }
    reload();
  }, [scope, scopeId, reload]);

  const save = async (key: string, value: unknown, notes?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/settings/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          scopeId: scope === 'system' ? undefined : scopeId,
          value,
          notes,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(t('settings.saved', 'Saved'));
      reload();
    } catch (err) {
      toast.error(
        t('settings.saveFailed', 'Save failed: {{msg}}', {
          msg: (err as Error).message,
        }),
      );
    }
  };

  const clear = async (key: string) => {
    try {
      const params = new URLSearchParams({ scope });
      if (scope !== 'system' && scopeId) params.set('scopeId', scopeId);
      const res = await fetch(
        `${API_BASE_URL}/admin/settings/${encodeURIComponent(key)}?${params.toString()}`,
        { method: 'DELETE', credentials: 'include' },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success(t('settings.cleared', 'Override removed'));
      reload();
    } catch (err) {
      toast.error(
        t('settings.clearFailed', 'Clear failed: {{msg}}', {
          msg: (err as Error).message,
        }),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {t('settings.title', 'Platform settings')}
        </h2>
        <p className="text-foreground/60 mt-1 text-sm">
          {t(
            'settings.subtitle',
            'Scoped toggles &amp; thresholds. Narrower scope wins on lookup: user → org → system → built-in default. New modules register keys in code; storage stays the same.',
          )}
        </p>
      </div>

      <Card className="rounded-xl p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
              {t('settings.scope', 'Scope')}
            </label>
            <Select value={scope} onValueChange={(v) => setScope(v as SettingScope)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System (default)</SelectItem>
                <SelectItem value="org">Org override</SelectItem>
                <SelectItem value="user">User override</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope !== 'system' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
                {scope === 'org'
                  ? t('settings.orgId', 'Org ID')
                  : t('settings.userId', 'User ID')}
              </label>
              <Input
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                placeholder={
                  scope === 'org' ? 'org_xxx' : 'user_xxx'
                }
                className="w-[260px]"
              />
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : rows.length === 0 && scope !== 'system' && !scopeId ? (
        <p className="text-foreground/50 text-sm">
          {t('settings.enterScopeId', 'Enter a {{scope}} ID above to view its overrides.', {
            scope,
          })}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <SettingRowEditor
              key={row.def.key}
              row={row}
              scope={scope}
              onSave={(value, notes) => save(row.def.key, value, notes)}
              onClear={() => clear(row.def.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettingRowEditor({
  row,
  scope,
  onSave,
  onClear,
}: {
  row: SettingRow;
  scope: SettingScope;
  onSave: (value: unknown, notes?: string) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const def = row.def;
  const inputType = inferType(def);
  const allowed = isScopeAllowed(def.scope, scope);

  const initial = row.override?.value ?? row.effective ?? def.default;
  const [value, setValue] = useState<unknown>(initial);
  const [notes, setNotes] = useState<string>(row.override?.notes ?? '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(row.override?.value ?? row.effective ?? def.default);
    setNotes(row.override?.notes ?? '');
    setDirty(false);
  }, [row, def.default]);

  const update = (v: unknown) => {
    setValue(v);
    setDirty(true);
  };

  return (
    <Card className="rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-foreground">{def.label}</h3>
            <Badge variant="info" outline className="font-mono text-[10px]">
              {def.key}
            </Badge>
            <Badge variant="success" outline className="text-[10px] capitalize">
              max scope: {def.scope}
            </Badge>
            {row.override && (
              <Badge variant="warning" className="text-[10px]">
                {t('settings.overridden', 'Overridden')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-foreground/60 mt-1">{def.description}</p>
          <p className="text-xs text-foreground/40 mt-2">
            {t('settings.effective', 'Effective:')}{' '}
            <span className="font-mono text-foreground/70">
              {formatValue(row.effective)}
            </span>
            {' · '}
            {t('settings.default', 'default:')}{' '}
            <span className="font-mono text-foreground/50">
              {formatValue(def.default)}
            </span>
          </p>
        </div>
      </div>

      {!allowed ? (
        <p className="text-xs text-foreground/40 mt-3">
          {t('settings.notAllowedHere', 'This setting cannot be overridden at the {{scope}} scope.', {
            scope,
          })}
        </p>
      ) : (
        <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
          {inputType === 'boolean' && (
            <div className="flex items-center gap-3">
              <Switch
                checked={Boolean(value)}
                onCheckedChange={(v) => update(v)}
              />
              <span className="text-sm text-foreground/70">
                {value ? 'enabled' : 'disabled'}
              </span>
            </div>
          )}
          {inputType === 'number' && (
            <Input
              type="number"
              value={String(value ?? '')}
              onChange={(e) => update(Number(e.target.value))}
              className="w-[200px]"
            />
          )}
          {inputType === 'string' && (
            <Input
              value={String(value ?? '')}
              onChange={(e) => update(e.target.value)}
              className="w-full max-w-[480px]"
            />
          )}
          {inputType === 'json' && (
            <Textarea
              value={
                typeof value === 'string' ? value : JSON.stringify(value, null, 2)
              }
              onChange={(e) => {
                try {
                  update(JSON.parse(e.target.value));
                } catch {
                  update(e.target.value);
                }
              }}
              rows={4}
              className="font-mono text-xs"
            />
          )}

          <Textarea
            placeholder={t('settings.notesPlaceholder', 'Optional notes (why this override exists)…')}
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setDirty(true);
            }}
            rows={2}
            className="text-sm"
          />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!dirty}
              onClick={() => onSave(value, notes || undefined)}
            >
              {row.override
                ? t('settings.update', 'Update override')
                : t('settings.save', 'Save override')}
            </Button>
            {row.override && (
              <Button size="sm" variant="ghost" onClick={onClear}>
                {t('settings.remove', 'Remove override')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function isScopeAllowed(maxScope: SettingScope, target: SettingScope): boolean {
  if (target === 'system') return true;
  if (maxScope === 'system') return false;
  if (target === 'org') return maxScope === 'org' || maxScope === 'user';
  if (target === 'user') return maxScope === 'user';
  return false;
}

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default AdminSettingsPage;
