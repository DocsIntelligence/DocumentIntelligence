import type { DocumentSigner, SignerRole } from '@org/api-client';
import {
  Badge,
  Button,
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
} from '@org/ui';
import { cn } from '@org/utils';
import { useRef, useState } from 'react';
import {
  useAddSigner,
  useRemoveSigner,
  useSigners,
  useSignSigner,
} from './queries';

const ROLE_LABELS: Record<SignerRole, string> = {
  party_a: 'Party A',
  party_b: 'Party B',
  witness: 'Witness',
  lawyer: 'Lawyer',
  custom: 'Other',
};

const STATUS_VARIANT: Record<
  string,
  'success' | 'secondary' | 'info' | 'error'
> = {
  signed: 'success',
  pending: 'secondary',
  invited: 'info',
  viewed: 'info',
  declined: 'error',
};

/**
 * Manage a document's signers and capture drawn/typed signatures (owner side).
 * Remote provider eSign (Aadhaar/DSC) is a separate flow.
 */
export function SignaturesDialog({
  documentId,
  open,
  onOpenChange,
}: {
  documentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const signers = useSigners(documentId, open);
  const add = useAddSigner(documentId);
  const remove = useRemoveSigner(documentId);
  const sign = useSignSigner(documentId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SignerRole>('party_a');
  const [signingId, setSigningId] = useState<string | null>(null);

  const items = signers.data ?? [];

  async function addSigner() {
    if (!name.trim()) return;
    await add.mutateAsync({
      name: name.trim(),
      email: email.trim() || undefined,
      role,
    });
    setName('');
    setEmail('');
    setRole('party_a');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signatures</DialogTitle>
          <DialogDescription>
            Add the people who need to sign, then capture each signature by
            drawing or typing it. The document is marked signed once everyone
            has signed.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-2 overflow-y-auto py-1">
          {signers.isLoading && (
            <p className="text-sm text-foreground/55">Loading…</p>
          )}
          {!signers.isLoading && items.length === 0 && (
            <p className="py-6 text-center text-sm text-foreground/55">
              No signers yet.
            </p>
          )}
          {items.map((s) => (
            <SignerRow
              key={s.id}
              signer={s}
              isSigning={signingId === s.id}
              onToggleSign={() =>
                setSigningId((cur) => (cur === s.id ? null : s.id))
              }
              onRemove={() => remove.mutate(s.id)}
              onSubmit={async (payload) => {
                await sign.mutateAsync({ signerId: s.id, payload });
                setSigningId(null);
              }}
              saving={sign.isPending}
            />
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <Label className="text-xs text-foreground/60">Add a signer</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="sm:flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as SignerRole)}>
              <SelectTrigger className="sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLE_LABELS) as SignerRole[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              isLoading={add.isPending}
              disabled={!name.trim()}
              onClick={addSigner}
            >
              Add signer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SignerRow({
  signer,
  isSigning,
  onToggleSign,
  onRemove,
  onSubmit,
  saving,
}: {
  signer: DocumentSigner;
  isSigning: boolean;
  onToggleSign: () => void;
  onRemove: () => void;
  onSubmit: (payload: {
    method: 'draw' | 'typed';
    image?: string;
    typedText?: string;
    font?: string;
  }) => void;
  saving: boolean;
}) {
  const signed = signer.status === 'signed';
  const evidenceImage =
    typeof signer.evidence?.['image'] === 'string'
      ? (signer.evidence['image'] as string)
      : null;
  const evidenceTyped =
    typeof signer.evidence?.['typedText'] === 'string'
      ? (signer.evidence['typedText'] as string)
      : null;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-sm font-medium text-foreground">
            {signer.name}
          </span>
          <span className="ml-2 text-[11px] text-foreground/45">
            {ROLE_LABELS[signer.role]}
            {signer.email ? ` · ${signer.email}` : ''}
          </span>
        </div>
        <Badge
          variant={STATUS_VARIANT[signer.status] ?? 'secondary'}
          outline={signer.status !== 'signed'}
        >
          {signer.status}
        </Badge>
      </div>

      {signed && (evidenceImage || evidenceTyped) && (
        <div className="mt-2">
          {evidenceImage ? (
            <img
              src={evidenceImage}
              alt={`${signer.name} signature`}
              className="h-14 rounded border border-border bg-white object-contain"
            />
          ) : (
            <span
              className="text-2xl text-foreground"
              style={{ fontFamily: 'cursive' }}
            >
              {evidenceTyped}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSign}
          className="text-xs font-medium text-primary hover:underline"
        >
          {isSigning ? 'Cancel' : signed ? 'Re-sign' : 'Sign'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-error hover:underline"
        >
          Remove
        </button>
      </div>

      {isSigning && (
        <SignatureCapture
          defaultName={signer.name}
          saving={saving}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}

function SignatureCapture({
  defaultName,
  saving,
  onSubmit,
}: {
  defaultName: string;
  saving: boolean;
  onSubmit: (payload: {
    method: 'draw' | 'typed';
    image?: string;
    typedText?: string;
    font?: string;
  }) => void;
}) {
  const [mode, setMode] = useState<'draw' | 'typed'>('draw');
  const [typed, setTyped] = useState(defaultName);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  function ctx() {
    const c = canvasRef.current;
    return c ? c.getContext('2d') : null;
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const g = ctx();
    if (!g) return;
    drawing.current = true;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.strokeStyle = '#111827';
    g.beginPath();
    g.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const g = ctx();
    if (!g) return;
    g.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    g.stroke();
    setHasInk(true);
  }
  function end() {
    drawing.current = false;
  }
  function clear() {
    const c = canvasRef.current;
    const g = ctx();
    if (c && g) g.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function submit() {
    if (mode === 'draw') {
      const c = canvasRef.current;
      if (!c || !hasInk) return;
      onSubmit({ method: 'draw', image: c.toDataURL('image/png') });
    } else {
      if (!typed.trim()) return;
      onSubmit({ method: 'typed', typedText: typed.trim(), font: 'cursive' });
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/20 p-3">
      <div className="flex gap-2">
        {(['draw', 'typed'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium',
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/60 hover:bg-secondary',
            )}
          >
            {m === 'draw' ? 'Draw' : 'Type'}
          </button>
        ))}
      </div>

      {mode === 'draw' ? (
        <div className="space-y-1.5">
          <canvas
            ref={canvasRef}
            width={440}
            height={150}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full touch-none rounded border border-border bg-white"
          />
          <button
            type="button"
            onClick={clear}
            className="text-xs text-foreground/55 hover:underline"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Type your name"
          />
          <div className="flex h-14 items-center rounded border border-border bg-white px-3">
            <span
              className="text-2xl text-gray-900"
              style={{ fontFamily: 'cursive' }}
            >
              {typed || 'Preview'}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          isLoading={saving}
          disabled={mode === 'draw' ? !hasInk : !typed.trim()}
          onClick={submit}
        >
          Save signature
        </Button>
      </div>
    </div>
  );
}
