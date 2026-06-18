import type {
  CreateAssetPayload,
  CreateEstateProfilePayload,
  CreateNomineePayload,
  ListEstateAssetsQuery,
  RecordValuationPayload,
  SetNominationsPayload,
  UpdateAssetPayload,
  UpdateNomineePayload,
  UpdateReleasePlanPayload,
} from '@org/api-client';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEstateService } from '../documents/services-context';

export const estateKeys = {
  all: ['estate'] as const,
  capability: ['estate', 'capability'] as const,
  assetTypes: ['estate', 'asset-types'] as const,
  netWorth: ['estate', 'networth'] as const,
  netWorthHistory: ['estate', 'networth', 'history'] as const,
  assets: ['estate', 'assets'] as const,
  assetsPage: (params: ListEstateAssetsQuery) =>
    ['estate', 'assets', params] as const,
  asset: (id: string) => ['estate', 'asset', id] as const,
  valuations: (id: string) => ['estate', 'asset', id, 'valuations'] as const,
  search: (q: string) => ['estate', 'search', q] as const,
};

// ── Profiles (managed person-vaults) ─────────────────────────────────────────
// NOTE: the key prefix is intentionally `['estate-profiles']`, NOT under
// `['estate']`. Switching the active profile does
// `removeQueries({ queryKey: ['estate'] })` to drop all profile-scoped data; the
// profile list + access rows must survive that clear (they aren't profile-scoped
// — the interceptor exempts `/estate/profiles*`), so they live in their own tree.
export const estateProfileKeys = {
  all: ['estate-profiles'] as const,
  access: (id: string) => ['estate-profiles', id, 'access'] as const,
};

export function useEstateProfiles() {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateProfileKeys.all,
    queryFn: () => svc.listProfiles(),
    staleTime: 60_000,
  });
}

export function useCreateProfile() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEstateProfilePayload) =>
      svc.createProfile(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateProfileKeys.all });
      toast.success('Profile added');
    },
    onError: () => toast.error('Could not add profile'),
  });
}

export function useUpdateProfile() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      id: string;
      patch: { label?: string; maskAmounts?: boolean };
    }) => svc.updateProfile(args.id, args.patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateProfileKeys.all });
    },
    onError: () => toast.error('Could not update profile'),
  });
}

export function useRemoveProfile() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.removeProfile(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateProfileKeys.all });
      toast.success('Profile removed');
    },
    onError: () =>
      toast.error('Could not remove profile (self and non-empty profiles are kept)'),
  });
}

export function useProfileAccess(id: string | undefined, enabled = true) {
  const svc = useEstateService();
  return useQuery({
    queryKey: id ? estateProfileKeys.access(id) : ['estate-profiles', 'none', 'access'],
    queryFn: () => svc.listProfileAccess(id as string),
    enabled: !!id && enabled,
  });
}

export function useShareProfile(id: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { email: string; role: 'manager' | 'viewer' }) =>
      svc.shareProfile(id, args.email, args.role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateProfileKeys.access(id) });
      toast.success('Shared');
    },
    onError: () => toast.error('Could not share — check the email is a registered account'),
  });
}

export function useUnshareProfile(id: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => svc.unshareProfile(id, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateProfileKeys.access(id) });
      toast.success('Access removed');
    },
    onError: () => toast.error('Could not remove access'),
  });
}

/** Module capability — drives nav/route gating. `retry:false` so a 404 (module
 *  disabled) resolves to an error state the UI treats as "off". */
export function useEstateCapability() {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateKeys.capability,
    queryFn: () => svc.capability(),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAssetTypes() {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateKeys.assetTypes,
    queryFn: () => svc.assetTypes(),
    staleTime: 5 * 60_000,
  });
}

export function useNetWorth() {
  const svc = useEstateService();
  return useQuery({ queryKey: estateKeys.netWorth, queryFn: () => svc.netWorth() });
}

export function useNetWorthHistory() {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateKeys.netWorthHistory,
    queryFn: () => svc.netWorthHistory(),
  });
}

export function useAssets(params: ListEstateAssetsQuery = {}) {
  const svc = useEstateService();
  return useQuery({
    queryKey: estateKeys.assetsPage(params),
    queryFn: () => svc.listAssets(params),
    placeholderData: keepPreviousData,
  });
}

/** Vault-wide search (assets + document text + AI analysis). Disabled until the
 *  caller types a query; debounce `q` before passing it in. */
export function useVaultSearch(q: string) {
  const svc = useEstateService();
  const trimmed = q.trim();
  return useQuery({
    queryKey: estateKeys.search(trimmed),
    queryFn: () => svc.searchVault(trimmed),
    enabled: trimmed.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useAsset(id: string | undefined) {
  const svc = useEstateService();
  return useQuery({
    queryKey: id ? estateKeys.asset(id) : ['estate', 'asset', 'none'],
    queryFn: () => svc.getAsset(id as string),
    enabled: !!id,
  });
}

export function useAssetValuations(id: string | undefined) {
  const svc = useEstateService();
  return useQuery({
    queryKey: id ? estateKeys.valuations(id) : ['estate', 'valuations', 'none'],
    queryFn: () => svc.valuations(id as string),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAssetPayload) => svc.createAsset(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateKeys.assets });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      toast.success('Asset added');
    },
    onError: () => toast.error('Could not add asset'),
  });
}

/** Multi-file import: N files (+ optional per-file passwords) → one asset each. */
export function useImportFiles() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { files: File[]; passwords?: (string | undefined)[] }) =>
      svc.importFiles(args.files, args.passwords),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: estateKeys.assets });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      void qc.invalidateQueries({ queryKey: ['estate', 'nudges'] });
      if (r.created > 0) toast.success(`Imported ${r.created} of ${r.total}`);
    },
    onError: () => toast.error('Could not import files'),
  });
}

export function useBulkCreateAssets() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      assets: CreateAssetPayload[];
      source?: { file: File; password?: string };
    }) => svc.bulkCreateAssets(vars.assets, vars.source),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: estateKeys.assets });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      void qc.invalidateQueries({ queryKey: ['estate', 'nudges'] });
      toast.success(`Imported ${r.created} new, updated ${r.updated}`);
    },
    onError: () => toast.error('Could not import assets'),
  });
}

export function useUpdateAsset(id: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateAssetPayload) => svc.updateAsset(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateKeys.asset(id) });
      void qc.invalidateQueries({ queryKey: estateKeys.assets });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      toast.success('Saved');
    },
    onError: () => toast.error('Could not save'),
  });
}

export function useDeleteAsset() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.deleteAsset(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateKeys.assets });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      toast.success('Asset removed');
    },
    onError: () => toast.error('Could not remove asset'),
  });
}

/** Soft-delete several assets at once (bulk action on the list). */
export function useBulkDeleteAssets() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => svc.deleteAsset(id)));
      return ids.length;
    },
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: estateKeys.assets });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      void qc.invalidateQueries({ queryKey: ['estate', 'nudges'] });
      toast.success(`Removed ${n} asset${n === 1 ? '' : 's'}`);
    },
    onError: () => toast.error('Could not remove the selected assets'),
  });
}

export function useRecordValuation(id: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RecordValuationPayload) =>
      svc.recordValuation(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: estateKeys.asset(id) });
      void qc.invalidateQueries({ queryKey: estateKeys.valuations(id) });
      void qc.invalidateQueries({ queryKey: estateKeys.netWorth });
      toast.success('Value updated');
    },
    onError: () => toast.error('Could not update value'),
  });
}

// ── Nominees + nominations (M5) ──────────────────────────────────────────────

export function useNominees() {
  const svc = useEstateService();
  return useQuery({
    queryKey: ['estate', 'nominees'],
    queryFn: () => svc.listNominees(),
  });
}

export function useCreateNominee() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreateNomineePayload) => svc.createNominee(p),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'nominees'] });
      void qc.invalidateQueries({ queryKey: ['estate', 'release'] });
      toast.success('Nominee added');
    },
    onError: () => toast.error('Could not add nominee'),
  });
}

export function useUpdateNominee(id: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpdateNomineePayload) => svc.updateNominee(id, p),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'nominees'] });
      toast.success('Saved');
    },
    onError: () => toast.error('Could not save'),
  });
}

export function useDeleteNominee() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => svc.deleteNominee(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'nominees'] });
      void qc.invalidateQueries({ queryKey: ['estate', 'release'] });
      toast.success('Nominee removed');
    },
    onError: () => toast.error('Could not remove nominee'),
  });
}

export function useNominations(assetId: string | undefined) {
  const svc = useEstateService();
  return useQuery({
    queryKey: assetId
      ? ['estate', 'asset', assetId, 'nominations']
      : ['estate', 'nominations', 'none'],
    queryFn: () => svc.listNominations(assetId as string),
    enabled: !!assetId,
  });
}

export function useSetNominations(assetId: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: SetNominationsPayload) => svc.setNominations(assetId, p),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['estate', 'asset', assetId, 'nominations'],
      });
      toast.success('Nominees updated');
    },
    onError: () => toast.error('Could not update nominees'),
  });
}

// ── Release / dead-man-switch (M5) ───────────────────────────────────────────

export function useGrants() {
  const svc = useEstateService();
  return useQuery({
    queryKey: ['estate', 'release'],
    queryFn: () => svc.listGrants(),
  });
}

export function useCheckIn() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => svc.checkIn(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'release'] });
      toast.success("You're checked in");
    },
    onError: () => toast.error('Could not check in'),
  });
}

export function useUpdateReleasePlan() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { nomineeId: string; payload: UpdateReleasePlanPayload }) =>
      svc.updateReleasePlan(args.nomineeId, args.payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'release'] });
      toast.success('Release plan updated');
    },
    onError: () => toast.error('Could not update plan'),
  });
}

export function useRevokeGrant() {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nomineeId: string) => svc.revokeGrant(nomineeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'release'] });
      toast.success('Grant revoked');
    },
    onError: () => toast.error('Could not revoke'),
  });
}

export function useNudges() {
  const svc = useEstateService();
  return useQuery({
    queryKey: ['estate', 'nudges'],
    queryFn: () => svc.nudges(),
  });
}

export function useOwnerReport() {
  const svc = useEstateService();
  return useQuery({
    queryKey: ['estate', 'report'],
    queryFn: () => svc.ownerReport(),
  });
}

export function useNomineeAccess(token: string | undefined, enabled = true) {
  const svc = useEstateService();
  return useQuery({
    queryKey: ['estate', 'nominee-access', token],
    queryFn: () => svc.nomineeAccess(token as string),
    enabled: !!token && enabled,
    retry: false,
  });
}

/** Public grant status for the nominee page (works pre-release). */
export function useNomineeProofStatus(token: string | undefined) {
  const svc = useEstateService();
  return useQuery({
    queryKey: ['estate', 'nominee-status', token],
    queryFn: () => svc.nomineeProofStatus(token as string),
    enabled: !!token,
    retry: false,
  });
}

export function useSubmitNomineeProof(token: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; note?: string }) =>
      svc.submitNomineeProof(token, args.file, args.note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['estate', 'nominee-status', token] });
      toast.success('Proof submitted — it will be reviewed.');
    },
    onError: () => toast.error('Could not submit the file'),
  });
}

// ── Documents (M3) ───────────────────────────────────────────────────────────

export function useAssetDocuments(assetId: string | undefined) {
  const svc = useEstateService();
  return useQuery({
    queryKey: assetId
      ? ['estate', 'asset', assetId, 'documents']
      : ['estate', 'documents', 'none'],
    queryFn: () => svc.listDocuments(assetId as string),
    enabled: !!assetId,
  });
}

export function useAddDocument(assetId: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      file: File;
      kind?: string;
      slotKey?: string;
      periodAsOf?: string;
    }) => svc.addDocument(assetId, args.file, args),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['estate', 'asset', assetId, 'documents'],
      });
      toast.success('Document added');
    },
    onError: () => toast.error('Could not add document'),
  });
}

export function useRemoveDocument(assetId: string) {
  const svc = useEstateService();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => svc.removeDocument(assetId, docId),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ['estate', 'asset', assetId, 'documents'],
      });
      toast.success('Document removed');
    },
    onError: () => toast.error('Could not remove document'),
  });
}

/**
 * Detect the API's "PDF needs a password" 400 from an axios-style error.
 * Returns 'incorrect' (wrong password supplied), 'required' (none / protected),
 * or null when it's some other failure. Drives the password-retry prompt.
 */
export function isPdfPasswordError(
  e: unknown,
): 'incorrect' | 'required' | null {
  const res = (e as { response?: { status?: number; data?: unknown } })
    ?.response;
  const data = res?.data as { code?: string; message?: string } | undefined;
  const code = data?.code;
  if (code === 'PDF_PASSWORD_INCORRECT') return 'incorrect';
  if (code === 'PDF_PASSWORD_REQUIRED') return 'required';
  // Fallback to message sniffing if the body isn't structured.
  const msg = (data?.message ?? '').toLowerCase();
  if (res?.status === 400 && msg.includes('password')) {
    return msg.includes('incorrect') ? 'incorrect' : 'required';
  }
  return null;
}

/** Format a major-unit amount in the user's locale. When `masked`, the digits
 *  are hidden (privacy default per profile) but the currency symbol is kept. */
export function formatMoney(
  value: number,
  currency = 'INR',
  masked = false,
): string {
  if (masked) {
    try {
      const sym = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value;
      return `${sym ?? currency} ••••••`;
    } catch {
      return '••••••';
    }
  }
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-IN')}`;
  }
}
