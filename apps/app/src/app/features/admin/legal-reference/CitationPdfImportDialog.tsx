import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@org/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { APP_ENV } from '../../../../config';

const API_BASE_URL = APP_ENV.apiUrl;

/** A fully-populated example the user can download, edit, and re-upload — shows
 *  every supported field. Mirrors docs/samples/legal-citations-import.sample.json. */
const SAMPLE_JSON = [
  {
    id: 'bns.103',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '103',
    title: 'Punishment for murder',
    summary:
      'Section 103 prescribes the punishment for murder (defined in §101): death or imprisonment for life, plus fine. Sub-section (2) covers murder by a group of five or more persons on a ground such as race, caste, sex, language or personal belief.\n\nFor a drafter, plead the ingredients of murder under §101 precisely and distinguish from culpable homicide not amounting to murder (§105).',
    fullText:
      '103. (1) Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. (2) When a group of five or more persons acting in concert commits murder on the ground of race, caste or community, sex, place of birth, language, personal belief or any other similar ground, each member shall be punished with death or imprisonment for life, and shall also be liable to fine.',
    draftingTips:
      '- Plead each ingredient of murder under §101 before invoking §103.\n- Distinguish from culpable homicide not amounting to murder (§105).\n- Replaces IPC §302 for offences on or after 1 July 2024.',
    topics: ['criminal', 'bns', 'murder'],
    appliesTo: ['legal_notice', 'anticipatory_bail'],
    confidence: 'high',
    supersedes: 'ipc.302',
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/20062',
    effectiveFrom: '2024-07-01',
    verifyNote:
      'Verify the section text against the official BNS, 2023 bare act before binding use.',
  },
  {
    id: 'bns.351',
    act: 'Bharatiya Nyaya Sanhita, 2023',
    actShort: 'BNS',
    section: '351',
    title: 'Criminal intimidation',
    summary:
      'Section 351 defines criminal intimidation: threatening another with injury to person, reputation or property with intent to cause alarm or to compel/deter a lawful act. Punishment graduates for aggravated threats (death, grievous hurt, fire).',
    fullText:
      '351. (1) Whoever threatens another with any injury to his person, reputation or property … with intent to cause alarm … commits criminal intimidation.',
    draftingTips:
      '- Identify the specific threat and the intent.\n- Replaces IPC §503/§506 for offences on or after 1 July 2024.',
    topics: ['criminal', 'bns', 'criminal-intimidation'],
    appliesTo: ['legal_notice'],
    confidence: 'high',
    supersedes: 'ipc.503',
    externalUrl: 'https://www.indiacode.nic.in/handle/123456789/20062',
    effectiveFrom: '2024-07-01',
    verifyNote: 'Verify the section text and numbering against the official BNS, 2023 bare act.',
  },
];

function downloadSampleJson() {
  const blob = new Blob([JSON.stringify(SAMPLE_JSON, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'legal-citations-import.sample.json';
  a.click();
  URL.revokeObjectURL(url);
}

interface SectionPreview {
  id: string;
  section: string;
  title: string;
  charCount: number;
  snippet: string;
}

interface ParseResp {
  importId: string;
  preview: SectionPreview[];
  totalChars: number;
  detectedCount: number;
  warnings: string[];
}

/**
 * Bulk-import every section of a bare-act PDF (e.g. the whole 100+ page BNS)
 * into the citation catalog. Two steps so the (potentially huge) parse never
 * round-trips its full text through the browser: parse → review a lightweight
 * preview → commit by importId (the server holds the parsed text + writes in
 * batches). Statute text is extracted verbatim; nothing is AI-authored.
 */
export function CitationPdfImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();

  const [mode, setMode] = useState<'pdf' | 'json'>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [codePrefix, setCodePrefix] = useState('bns');
  const [actName, setActName] = useState('Bharatiya Nyaya Sanhita, 2023');
  const [actShort, setActShort] = useState('BNS');
  const [topics, setTopics] = useState('criminal, bns');
  const [effectiveFrom, setEffectiveFrom] = useState('2024-07-01');
  const [confidence, setConfidence] = useState<'high' | 'moderate' | 'low'>(
    'moderate',
  );
  const [password, setPassword] = useState('');
  const [overwrite, setOverwrite] = useState(false);

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<ParseResp | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const reset = () => {
    setFile(null);
    setJsonFile(null);
    setJsonText('');
    setResult(null);
    setExcluded(new Set());
    setPassword('');
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canParse =
    mode === 'pdf' ? !!file : !!jsonFile || jsonText.trim().length > 0;

  const parse = async () => {
    if (!canParse) return;
    setParsing(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('codePrefix', codePrefix.trim());
      form.append('actName', actName.trim());
      if (actShort.trim()) form.append('actShort', actShort.trim());
      if (topics.trim()) form.append('topics', topics.trim());
      if (effectiveFrom.trim()) form.append('effectiveFrom', effectiveFrom.trim());
      form.append('confidence', confidence);

      let endpoint: string;
      if (mode === 'pdf') {
        form.append('file', file as File);
        if (password) form.append('password', password);
        endpoint = 'parse';
      } else {
        if (jsonFile) form.append('file', jsonFile);
        else form.append('json', jsonText);
        endpoint = 'json';
      }

      const res = await fetch(
        `${API_BASE_URL}/legal-ai/admin/citations/import/${endpoint}`,
        { method: 'POST', credentials: 'include', body: form },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Parse failed (${res.status})`);
      }
      const data: ParseResp = await res.json();
      setResult(data);
      setExcluded(new Set());
      if (data.detectedCount === 0) {
        toast.error(t('legalRefs.import.none', 'No sections detected.'));
      } else {
        toast.success(
          t('legalRefs.import.parsed', 'Detected {{n}} sections — review below.', {
            n: data.detectedCount,
          }),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  };

  const commit = async () => {
    if (!result) return;
    const includeIds = result.preview
      .map((s) => s.id)
      .filter((id) => !excluded.has(id));
    if (includeIds.length === 0) {
      toast.error(t('legalRefs.import.pickSome', 'Select at least one section.'));
      return;
    }
    setCommitting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/legal-ai/admin/citations/import/commit`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            importId: result.importId,
            includeIds,
            overwriteExisting: overwrite,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Commit failed (${res.status})`);
      }
      const data: { created: string[]; skipped: string[]; total: number } =
        await res.json();
      toast.success(
        t(
          'legalRefs.import.committed',
          'Imported {{created}} citation(s){{skipped}}.',
          {
            created: data.created.length,
            skipped: data.skipped.length
              ? `, skipped ${data.skipped.length} existing`
              : '',
          },
        ),
      );
      onImported();
      close(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  };

  const includedCount = result
    ? result.preview.length - excluded.size
    : 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {t('legalRefs.import.title', 'Bulk-import citations')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'legalRefs.import.desc',
              'Import many sections at once — from an official bare-act PDF (verbatim text, summary stubbed) or from a JSON array you prepared (full control of every field). Review before importing.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {/* Source mode */}
          <div className="flex gap-1 rounded-md bg-secondary/50 p-1">
            {(['pdf', 'json'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setResult(null);
                }}
                className={
                  'flex-1 rounded px-3 py-1.5 text-xs font-medium ' +
                  (mode === m
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-foreground/60 hover:text-foreground')
                }
              >
                {m === 'pdf'
                  ? t('legalRefs.import.modePdf', 'Bare-act PDF')
                  : t('legalRefs.import.modeJson', 'JSON array')}
              </button>
            ))}
          </div>

          {/* Metadata — used as per-record fallbacks in JSON mode. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t('legalRefs.import.prefix', 'ID prefix')}</Label>
              <Input
                value={codePrefix}
                onChange={(e) => setCodePrefix(e.target.value)}
                placeholder="bns"
              />
            </div>
            <div className="space-y-1">
              <Label>{t('legalRefs.import.actShort', 'Short label')}</Label>
              <Input
                value={actShort}
                onChange={(e) => setActShort(e.target.value)}
                placeholder="BNS"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>{t('legalRefs.import.actName', 'Act name')}</Label>
              <Input
                value={actName}
                onChange={(e) => setActName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('legalRefs.import.topics', 'Topics (comma-sep)')}</Label>
              <Input
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('legalRefs.import.effective', 'Effective from')}</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('legalRefs.import.confidence', 'Confidence')}</Label>
              <Select
                value={confidence}
                onValueChange={(v) =>
                  setConfidence(v as 'high' | 'moderate' | 'low')
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === 'pdf' && (
              <div className="space-y-1">
                <Label>
                  {t('legalRefs.import.password', 'PDF password (optional)')}
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          {mode === 'pdf' ? (
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
              />
              <Button onClick={parse} disabled={!canParse || parsing}>
                {parsing && <Spinner className="mr-2 h-4 w-4" />}
                {t('legalRefs.import.parse', 'Parse')}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-foreground/55">
                  {t(
                    'legalRefs.import.jsonHelp',
                    'Upload (or paste) a JSON array. Each object: { "section", "title", "summary", "fullText", "draftingTips", "topics": [], "appliesTo": [], "confidence", "supersedes", "externalUrl", "effectiveFrom" }. Only "section" (or "id") + one of title/summary/fullText is required; missing fields fall back to the values above.',
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={downloadSampleJson}
                >
                  {t('legalRefs.import.sample', 'Download sample')}
                </Button>
              </div>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => setJsonFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
              />
              {!jsonFile && (
                <textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={6}
                  placeholder='[ { "section": "103", "title": "Punishment for murder", "summary": "…", "fullText": "…" } ]'
                  className="block w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
                />
              )}
              <div className="flex justify-end">
                <Button onClick={parse} disabled={!canParse || parsing}>
                  {parsing && <Spinner className="mr-2 h-4 w-4" />}
                  {t('legalRefs.import.parse', 'Parse')}
                </Button>
              </div>
            </div>
          )}

          {/* Warnings */}
          {result?.warnings.map((w) => (
            <p
              key={w}
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground"
            >
              ⚠ {w}
            </p>
          ))}

          {/* Preview */}
          {result && result.preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground/70">
                  {t(
                    'legalRefs.import.selected',
                    '{{n}} of {{total}} selected',
                    { n: includedCount, total: result.preview.length },
                  )}
                </span>
                <div className="flex gap-3 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setExcluded(new Set())}
                  >
                    {t('legalRefs.import.all', 'Select all')}
                  </button>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      setExcluded(new Set(result.preview.map((s) => s.id)))
                    }
                  >
                    {t('legalRefs.import.none', 'Select none')}
                  </button>
                </div>
              </div>
              <div className="max-h-72 divide-y divide-border/60 overflow-y-auto rounded-md border border-border">
                {result.preview.map((s) => {
                  const on = !excluded.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-secondary/40"
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(c) =>
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (c) next.delete(s.id);
                            else next.add(s.id);
                            return next;
                          })
                        }
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">§{s.section}</Badge>
                          <span className="truncate text-sm font-medium">
                            {s.title || (
                              <span className="text-foreground/40">
                                {t('legalRefs.import.noTitle', '(no heading detected)')}
                              </span>
                            )}
                          </span>
                          <span className="ml-auto shrink-0 text-[11px] text-foreground/45">
                            {s.charCount.toLocaleString()} chars
                          </span>
                        </div>
                        <p className="truncate text-xs text-foreground/55">
                          {s.snippet}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {result && result.preview.length > 0 && (
          <div className="mt-3 flex shrink-0 items-center justify-between border-t border-border pt-3">
            <label className="flex items-center gap-2 text-xs text-foreground/70">
              <Checkbox
                checked={overwrite}
                onCheckedChange={(c) => setOverwrite(!!c)}
              />
              {t(
                'legalRefs.import.overwrite',
                'Overwrite citations that already exist',
              )}
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => close(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={commit} disabled={committing || includedCount === 0}>
                {committing && <Spinner className="mr-2 h-4 w-4" />}
                {t('legalRefs.import.commit', 'Import {{n}} citations', {
                  n: includedCount,
                })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
