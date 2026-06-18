import type { HttpClient } from './http';

/**
 * Estate & Wealth Vault HTTP service (docs/13). Mirrors the other api-client
 * services: a factory over the shared axios client. Types match the API's
 * presented shapes (monetary values are MAJOR units, e.g. rupees).
 */

/**
 * AI document extraction (vision/text → structured holdings) is slow — a CAS
 * can take ~60s server-side. The shared client's default 30s timeout aborts
 * mid-flight, so the server finishes a 201 the client already discarded (and
 * we still pay for the AI call). These endpoints override the timeout.
 */
const AI_EXTRACT_TIMEOUT_MS = 180_000;
/** Bulk import fans out one AI extraction per file (up to 50) — give it room. */
const AI_BULK_TIMEOUT_MS = 600_000;

/** A managed person-vault. `role` is the acting user's access level. */
export interface EstateProfile {
  id: string;
  ownerUserId: string;
  vaultEntityId: string;
  label: string;
  isSelf: boolean;
  /** Privacy default: mask monetary amounts on screen until revealed. */
  maskAmounts: boolean;
  role: 'owner' | 'manager' | 'viewer';
}

export interface CreateEstateProfilePayload {
  label?: string;
  vaultEntityId?: string;
  name?: string;
  dob?: string;
  aadhaar?: string;
  pan?: string;
  phone?: string;
  address?: string;
}

export interface EstateProfileAccessRow {
  id: string;
  userId: string;
  email: string | null;
  name: string | null;
  role: string;
  createdAt: string;
}

export type AssetCategory = 'financial' | 'physical' | 'other';
export type AssetStatus = 'active' | 'matured' | 'closed';

export interface EstateAsset {
  id: string;
  type: string;
  label: string;
  institution: string | null;
  currency: string;
  value: number;
  /** Units/shares/grams held — only for unit-bearing types. Null = N/A. */
  units: number | null;
  identifierMasked: string | null;
  status: AssetStatus | string;
  maturityDate: string | null;
  /** Per-asset-type structured fields (shape driven by the app's static
   *  per-type registry). Non-secret; null when none set. */
  details: Record<string, string | number | boolean> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EstateAssetsListResult {
  items: EstateAsset[];
  total: number;
}

/** Where in an asset a vault search matched (drives the result badge). */
export type VaultSearchMatch = 'asset' | 'document' | 'analysis';

export interface VaultSearchHit {
  assetId: string;
  label: string;
  type: string;
  institution: string | null;
  status: string;
  value: number | null;
  currency: string;
  matchedIn: VaultSearchMatch;
  snippet: string;
}

export interface VaultSearchResult {
  items: VaultSearchHit[];
  total: number;
}

export interface ListEstateAssetsQuery {
  q?: string;
  type?: string;
  status?: AssetStatus;
  page?: number;
  pageSize?: number;
  sort?: 'label' | 'type' | 'value' | 'updated' | 'maturity';
  dir?: 'asc' | 'desc';
}

export interface EstateAssetType {
  key: string;
  label: string;
  category: AssetCategory;
  valuation: string;
  sortOrder: number;
  isActive: boolean;
  /** Type holds a quantity (MF/ETF units, shares, grams) — drives the units UI. */
  tracksUnits: boolean;
}

export interface EstateCapability {
  enabled: boolean;
  baseCurrency: string;
  toggles: Record<string, boolean>;
  assetTypes: EstateAssetType[];
}

export interface NetWorthBreakdown {
  type: string;
  label: string;
  category: AssetCategory;
  value: number;
}

export interface NetWorth {
  netWorth: number;
  currency: string;
  assetCount: number;
  byType: NetWorthBreakdown[];
}

export interface ValuationPoint {
  asOf: string;
  value: number;
  currency: string;
  source: string;
}

export interface NetWorthPoint {
  asOf: string;
  netWorth: number;
  currency: string;
}

export interface CreateAssetPayload {
  type: string;
  label: string;
  institution?: string;
  currency?: string;
  value?: number;
  /** Units/shares/grams held — only meaningful for unit-bearing types. */
  units?: number;
  identifier?: string;
  maturityDate?: string;
  status?: AssetStatus;
  notes?: string;
  /** Per-asset-type structured fields (see {@link EstateAsset.details}). */
  details?: Record<string, string | number | boolean>;
}

export type UpdateAssetPayload = Partial<CreateAssetPayload> & {
  isActive?: boolean;
};

export interface RecordValuationPayload {
  value: number;
  currency?: string;
  asOf?: string;
  source?: 'manual' | 'extracted' | 'aa';
}

export interface Nominee {
  id: string;
  name: string;
  email: string;
  relationship: string | null;
  dob: string | null;
  aadhaarMasked: string | null;
  panMasked: string | null;
  vaultEntityId: string | null;
  status: string;
  createdAt: string;
}

export interface NomineeReveal {
  id: string;
  vaultEntityId?: string | null;
  phone: string | null;
  aadhaar: string | null;
  pan: string | null;
  address: string | null;
}

export interface CreateNomineePayload {
  name: string;
  email: string;
  relationship?: string;
  dob?: string;
  phone?: string;
  aadhaar?: string;
  pan?: string;
  address?: string;
  vaultEntityId?: string;
}
export type UpdateNomineePayload = Partial<CreateNomineePayload>;

export interface AssetNomination {
  nomineeId: string;
  name: string;
  priority: number;
  sharePercent: number | null;
}

export interface SetNominationsPayload {
  nominations: { nomineeId: string; priority?: number; sharePercent?: number | null }[];
}

export interface ReleaseGrant {
  id: string;
  nominee: { id: string; name: string; email: string };
  scope: 'all' | 'nominated' | string;
  status: 'active' | 'pinged' | 'escalated' | 'released' | 'revoked' | string;
  cadenceDays: number;
  lastCheckInAt: string;
  nextPingAt: string;
  missedCount: number;
  releasedAt: string | null;
  accessToken: string | null;
}

export interface UpdateReleasePlanPayload {
  cadenceDays?: number;
  scope?: 'all' | 'nominated';
}

export interface GrantProof {
  index: number;
  filename: string;
  note: string | null;
  uploadedAt: string;
}

export interface AdminReleaseGrant extends ReleaseGrant {
  ownerUserId: string;
  proofs: GrantProof[];
}

/** Public status for the nominee page (pre-release) — no asset data. */
export interface NomineeProofStatus {
  status: string;
  released: boolean;
  nomineeName: string;
  proofCount: number;
}

export interface EstateReportAsset {
  id: string;
  type: string;
  typeLabel: string;
  label: string;
  institution: string | null;
  currency: string;
  value: number;
  identifier: string | null;
  identifierMasked: string | null;
  maturityDate: string | null;
  nominees: { name: string; priority: number }[];
  howToClaim: string;
}

export interface EstateReport {
  generatedAt: string;
  currency: string;
  totalValue: number;
  assetCount: number;
  assetsWithoutNominee: number;
  assets: EstateReportAsset[];
}

export interface NomineeAccessReport extends EstateReport {
  nominee: { name: string };
  releasedAt: string | null;
}

export interface Nudge {
  kind: string;
  severity: 'info' | 'warning';
  message: string;
  assetId?: string;
  assetLabel?: string;
}

export interface AssetDocument {
  id: string;
  slotKey: string;
  kind: string;
  filename: string;
  contentType: string;
  byteSize: number | null;
  periodAsOf: string | null;
  uploadedAt: string;
}

/** Analysis of an attached document — mirrors the docs-module AnalysisRun. */
export interface EstateDocAnalysis {
  id: string;
  summary: string | null;
  parties: { name: string; role?: string }[];
  keyDates: { label?: string; date?: string }[];
  obligations: { party?: string; text?: string }[];
  riskFlags: { severity?: string; text?: string }[];
  citationFindings: unknown[];
  createdAt: string;
}

/** Grounded Q&A answer over a document, with page-cited excerpts. */
export interface EstateDocAnswer {
  answer: string;
  citations: { page: number; snippet: string; score: number }[];
}

/** AI wealth analysis of the whole portfolio. Metrics are deterministic; the
 *  narrative (summary/risks/suggestions) interprets them. */
export interface PortfolioAnalysis {
  metrics: {
    netWorth: number;
    currency: string;
    assetCount: number;
    topHolding: { label: string; pct: number } | null;
    concentration: { label: string; value: number; pct: number }[];
    categorySplit: { category: string; value: number; pct: number }[];
    nomineeCoveragePct: number;
    assetsWithoutNominee: number;
    maturingSoon: { count: number; days: number };
  };
  summary: string;
  risks: { title: string; detail: string; severity: 'info' | 'warning' | 'high' }[];
  suggestions: { title: string; detail: string }[];
}

/** One asset-type row in the module config catalog (admin-editable, docs/13 §0.3). */
export interface EstateConfigAssetType {
  key: string;
  label: string;
  category: AssetCategory;
  valuation: 'manual' | 'spot_gold' | 'circle_rate' | string;
  sortOrder: number;
  isActive: boolean;
}

export interface EstateVaultToggles {
  netWorthDashboard: boolean;
  gapNudges: boolean;
  claimsConcierge: boolean;
  b2b2c: boolean;
}

export interface EstateLegalReview {
  status: 'pending' | 'in_review' | 'approved';
  note: string;
  reviewedBy: string;
  reviewedAt: string;
}

/** Resolved module config returned by the admin endpoint (docs/13 §0.3). */
export interface EstateVaultConfig {
  enabled: boolean;
  baseCurrency: string;
  livenessCadenceDays: number;
  missedPingsBeforeEscalation: number;
  coolingOffDays: number;
  maxNomineesPerAsset: number;
  freshnessThresholdDays: number;
  dormancyThresholdDays: number;
  toggles: EstateVaultToggles;
  assetTypes: EstateConfigAssetType[];
  legalReview: EstateLegalReview;
}

export type UpdateEstateVaultConfig = Partial<EstateVaultConfig>;

/** One file's outcome in a multi-file bulk import. */
export interface ImportFileResult {
  filename: string;
  status: 'created' | 'password_required' | 'password_incorrect' | 'failed';
  assetId?: string;
  label?: string;
  type?: string;
  value?: number;
  error?: string;
}

export interface ImportFilesResult {
  created: number;
  total: number;
  results: ImportFileResult[];
}

/** AI extract-assist suggestion for prefilling an asset (or one holding row). */
export interface AssetSuggestion {
  type?: string;
  label?: string;
  institution?: string;
  value?: number;
  /** Units/shares/grams held, if the statement reported a quantity. */
  units?: number;
  identifier?: string;
  maturityDate?: string;
  currency?: string;
  /** Per-asset-type structured fields extracted from the statement. */
  details?: Record<string, string | number>;
}

/** Result of extracting every holding from one statement, with reconciliation
 *  against the statement's own printed grand total (so an incomplete extraction
 *  is flagged rather than silently under-counting). */
export interface ExtractHoldingsResult {
  holdings: AssetSuggestion[];
  summary: {
    statedTotal?: number;
    statementDate?: string;
    currency?: string;
  };
  reconciliation: {
    extractedTotal: number;
    statedTotal?: number;
    /** (extracted − stated) / stated × 100. Negative = under-counted. */
    deltaPct?: number;
    /** True when |deltaPct| ≤ 1%. Null when the statement printed no total. */
    matched?: boolean;
    holdingsExtracted: number;
  };
}

export const createEstateService = (http: HttpClient) => ({
  // ── Profiles (managed person-vaults) ──────────────────────────────────────
  listProfiles: () =>
    http.get<EstateProfile[]>('/estate/profiles').then((r) => r.data),
  createProfile: (payload: CreateEstateProfilePayload) =>
    http.post<EstateProfile>('/estate/profiles', payload).then((r) => r.data),
  updateProfile: (
    id: string,
    patch: { label?: string; maskAmounts?: boolean },
  ) =>
    http
      .patch<EstateProfile>(`/estate/profiles/${id}`, patch)
      .then((r) => r.data),
  removeProfile: (id: string) =>
    http
      .delete<{ ok: boolean }>(`/estate/profiles/${id}`)
      .then((r) => r.data),
  listProfileAccess: (id: string) =>
    http
      .get<EstateProfileAccessRow[]>(`/estate/profiles/${id}/access`)
      .then((r) => r.data),
  shareProfile: (id: string, email: string, role: 'manager' | 'viewer') =>
    http
      .post<{ ok: boolean }>(`/estate/profiles/${id}/share`, { email, role })
      .then((r) => r.data),
  unshareProfile: (id: string, userId: string) =>
    http
      .delete<{ ok: boolean }>(`/estate/profiles/${id}/access/${userId}`)
      .then((r) => r.data),

  capability: () =>
    http.get<EstateCapability>('/estate/capability').then((r) => r.data),
  assetTypes: () =>
    http.get<EstateAssetType[]>('/estate/asset-types').then((r) => r.data),
  netWorth: () => http.get<NetWorth>('/estate/networth').then((r) => r.data),
  netWorthHistory: () =>
    http.get<NetWorthPoint[]>('/estate/networth/history').then((r) => r.data),
  analyzePortfolio: () =>
    http
      .post<PortfolioAnalysis>('/estate/portfolio/analyze', {}, {
        timeout: AI_EXTRACT_TIMEOUT_MS,
      })
      .then((r) => r.data),
  listAssets: (query?: ListEstateAssetsQuery) =>
    http
      .get<EstateAssetsListResult>('/estate/assets', { params: query })
      .then((r) => r.data),
  /** Vault-wide search across asset fields, document text and AI analysis
   *  (scoped to the active profile by the interceptor). */
  searchVault: (q: string, limit?: number) =>
    http
      .get<VaultSearchResult>('/estate/search', { params: { q, limit } })
      .then((r) => r.data),
  getAsset: (id: string) =>
    http.get<EstateAsset>(`/estate/assets/${id}`).then((r) => r.data),
  revealAsset: (id: string) =>
    http
      .get<{ id: string; identifier: string | null; notes: string | null }>(
        `/estate/assets/${id}/reveal`,
      )
      .then((r) => r.data),
  createAsset: (payload: CreateAssetPayload) =>
    http.post<EstateAsset>('/estate/assets', payload).then((r) => r.data),
  /** Bulk-import reviewed holdings. When `source` (the original statement) is
   *  passed, it's kept and attached to every imported asset — with its password
   *  retained (encrypted) so it can be re-opened/re-extracted later. */
  bulkCreateAssets: (
    assets: CreateAssetPayload[],
    source?: { file: File; password?: string },
  ) => {
    if (source?.file) {
      const form = new FormData();
      form.append('assets', JSON.stringify(assets));
      form.append('file', source.file);
      if (source.password) form.append('password', source.password);
      return http
        .post<{ created: number; updated: number }>(
          '/estate/import-holdings',
          form,
          { timeout: AI_EXTRACT_TIMEOUT_MS },
        )
        .then((r) => r.data);
    }
    return http
      .post<{ created: number; updated: number }>('/estate/assets/bulk', {
        assets,
      })
      .then((r) => r.data);
  },
  updateAsset: (id: string, payload: UpdateAssetPayload) =>
    http.patch<EstateAsset>(`/estate/assets/${id}`, payload).then((r) => r.data),
  deleteAsset: (id: string) =>
    http.delete<{ ok: boolean }>(`/estate/assets/${id}`).then((r) => r.data),
  recordValuation: (id: string, payload: RecordValuationPayload) =>
    http
      .post<{ ok: boolean }>(`/estate/assets/${id}/valuations`, payload)
      .then((r) => r.data),
  valuations: (id: string) =>
    http
      .get<ValuationPoint[]>(`/estate/assets/${id}/valuations`)
      .then((r) => r.data),

  // ── Nominees + nominations ────────────────────────────────────────────────
  listNominees: () =>
    http.get<Nominee[]>('/estate/nominees').then((r) => r.data),
  createNominee: (payload: CreateNomineePayload) =>
    http.post<Nominee>('/estate/nominees', payload).then((r) => r.data),
  updateNominee: (id: string, payload: UpdateNomineePayload) =>
    http.patch<Nominee>(`/estate/nominees/${id}`, payload).then((r) => r.data),
  revealNominee: (id: string) =>
    http
      .get<NomineeReveal>(`/estate/nominees/${id}/reveal`)
      .then((r) => r.data),
  deleteNominee: (id: string) =>
    http.delete<{ ok: boolean }>(`/estate/nominees/${id}`).then((r) => r.data),
  listNominations: (assetId: string) =>
    http
      .get<AssetNomination[]>(`/estate/assets/${assetId}/nominations`)
      .then((r) => r.data),
  setNominations: (assetId: string, payload: SetNominationsPayload) =>
    http
      .put<AssetNomination[]>(`/estate/assets/${assetId}/nominations`, payload)
      .then((r) => r.data),

  // ── Release / dead-man-switch ─────────────────────────────────────────────
  listGrants: () =>
    http.get<ReleaseGrant[]>('/estate/release').then((r) => r.data),
  checkIn: () =>
    http
      .post<{ ok: boolean; reset: number }>('/estate/checkin')
      .then((r) => r.data),
  updateReleasePlan: (nomineeId: string, payload: UpdateReleasePlanPayload) =>
    http
      .patch<ReleaseGrant>(`/estate/release/${nomineeId}`, payload)
      .then((r) => r.data),
  revokeGrant: (nomineeId: string) =>
    http
      .post<{ ok: boolean }>(`/estate/release/${nomineeId}/revoke`)
      .then((r) => r.data),

  // ── Estate Report ─────────────────────────────────────────────────────────
  ownerReport: () =>
    http.get<EstateReport>('/estate/report').then((r) => r.data),
  ownerReportPdf: () =>
    http
      .get<Blob>('/estate/report.pdf', { responseType: 'blob' })
      .then((r) => r.data),
  nudges: () => http.get<Nudge[]>('/estate/nudges').then((r) => r.data),
  nomineeAccess: (token: string) =>
    http
      .get<NomineeAccessReport>(`/estate/nominee-access/${token}`)
      .then((r) => r.data),
  nomineeProofStatus: (token: string) =>
    http
      .get<NomineeProofStatus>(`/estate/nominee-access/${token}/status`)
      .then((r) => r.data),
  submitNomineeProof: (token: string, file: File, note?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (note) form.append('note', note);
    return http
      .post<{ ok: boolean; proofCount: number }>(
        `/estate/nominee-access/${token}/proof`,
        form,
      )
      .then((r) => r.data);
  },

  // ── Admin: release grants ops + verification ──────────────────────────────
  adminListGrants: () =>
    http.get<AdminReleaseGrant[]>('/admin/estate-vault/grants').then((r) => r.data),
  adminReleaseGrant: (id: string) =>
    http
      .post<{ ok: boolean }>(`/admin/estate-vault/grants/${id}/release`)
      .then((r) => r.data),
  adminProofUrl: (id: string, index: number) =>
    http
      .get<{ url: string; filename: string; contentType: string }>(
        `/admin/estate-vault/grants/${id}/proof/${index}`,
      )
      .then((r) => r.data),

  // ── Documents + extract-assist (M3) ───────────────────────────────────────
  listDocuments: (assetId: string) =>
    http
      .get<AssetDocument[]>(`/estate/assets/${assetId}/documents`)
      .then((r) => r.data),
  addDocument: (
    assetId: string,
    file: File,
    opts: { kind?: string; slotKey?: string; periodAsOf?: string } = {},
  ) => {
    const form = new FormData();
    form.append('file', file);
    return http
      .post<AssetDocument>(`/estate/assets/${assetId}/documents`, form, {
        params: opts,
      })
      .then((r) => r.data);
  },
  documentUrl: (assetId: string, docId: string) =>
    http
      .get<{ url: string; filename: string; contentType: string }>(
        `/estate/assets/${assetId}/documents/${docId}/url`,
      )
      .then((r) => r.data),
  removeDocument: (assetId: string, docId: string) =>
    http
      .delete<{ ok: boolean }>(`/estate/assets/${assetId}/documents/${docId}`)
      .then((r) => r.data),
  extractFromDocument: (assetId: string, docId: string, password?: string) =>
    http
      .post<AssetSuggestion>(
        `/estate/assets/${assetId}/documents/${docId}/extract`,
        password ? { password } : {},
        { timeout: AI_EXTRACT_TIMEOUT_MS },
      )
      .then((r) => r.data),
  analyzeDocument: (assetId: string, docId: string, force?: boolean) =>
    http
      .post<EstateDocAnalysis>(
        `/estate/assets/${assetId}/documents/${docId}/analyze`,
        { force: !!force },
        { timeout: AI_EXTRACT_TIMEOUT_MS },
      )
      .then((r) => r.data),
  documentAnalysis: (assetId: string, docId: string) =>
    http
      .get<{ analysis: EstateDocAnalysis | null }>(
        `/estate/assets/${assetId}/documents/${docId}/analysis`,
      )
      .then((r) => r.data),
  askDocument: (assetId: string, docId: string, question: string) =>
    http
      .post<EstateDocAnswer>(
        `/estate/assets/${assetId}/documents/${docId}/ask`,
        { question },
        { timeout: AI_EXTRACT_TIMEOUT_MS },
      )
      .then((r) => r.data),
  extractFromUpload: (file: File, password?: string, assetType?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (password) form.append('password', password);
    if (assetType) form.append('assetType', assetType);
    return http
      .post<AssetSuggestion>('/estate/extract', form, {
        timeout: AI_EXTRACT_TIMEOUT_MS,
      })
      .then((r) => r.data);
  },
  extractHoldings: (file: File, password?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (password) form.append('password', password);
    return http
      .post<ExtractHoldingsResult>('/estate/extract-holdings', form, {
        timeout: AI_EXTRACT_TIMEOUT_MS,
      })
      .then((r) => r.data);
  },
  /** Bulk import: many files (with optional per-file passwords, aligned by
   *  index) → one asset created per file with the file attached. */
  importFiles: (files: File[], passwords?: (string | undefined)[]) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    if (passwords) form.append('passwords', JSON.stringify(passwords));
    return http
      .post<ImportFilesResult>('/estate/import-files', form, {
        timeout: AI_BULK_TIMEOUT_MS,
      })
      .then((r) => r.data);
  },

  // ── Admin config (config-as-data, docs/13 §0.3) ───────────────────────────
  adminGetConfig: () =>
    http
      .get<EstateVaultConfig>('/admin/estate-vault/config')
      .then((r) => r.data),
  adminUpdateConfig: (patch: UpdateEstateVaultConfig) =>
    http
      .put<EstateVaultConfig>('/admin/estate-vault/config', patch)
      .then((r) => r.data),
});

export type EstateService = ReturnType<typeof createEstateService>;
