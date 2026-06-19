import { Button, Input } from '@org/ui';
import { cn } from '@org/utils';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface SignaturePayload {
  method: 'draw' | 'upload' | 'typed';
  image?: string;
  typedText?: string;
  font?: string;
}

/**
 * Reusable signature pad: draw on a canvas, upload + normalise an image, or
 * type a name in a script font. Emits a {@link SignaturePayload}. Shared by the
 * document-signing dialog and the Vault (saved, reusable signatures) so the two
 * capture experiences stay identical.
 */
export function SignatureCapture({
  defaultName,
  saving,
  onSubmit,
  submitLabel,
}: {
  defaultName: string;
  saving: boolean;
  onSubmit: (payload: SignaturePayload) => void;
  /** Override the submit-button label (defaults to "Save signature"). */
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'draw' | 'upload' | 'typed'>('draw');
  const [typed, setTyped] = useState(defaultName);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Normalise an uploaded image: scale to a max width and re-encode PNG so it
  // stays well under the 2 MB cap and behaves like a drawn signature.
  function handleFile(file: File) {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError(
        t('signatures.errNotImage', 'Please choose an image file.'),
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 600;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        if (!g) {
          setUploadError(
            t('signatures.errProcess', 'Could not process image.'),
          );
          return;
        }
        g.drawImage(img, 0, 0, w, h);
        setUploaded(c.toDataURL('image/png'));
      };
      img.onerror = () =>
        setUploadError(
          t('signatures.errReadImage', 'Could not read that image.'),
        );
      img.src = reader.result as string;
    };
    reader.onerror = () =>
      setUploadError(t('signatures.errReadFile', 'Could not read that file.'));
    reader.readAsDataURL(file);
  }

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
    } else if (mode === 'upload') {
      if (!uploaded) return;
      onSubmit({ method: 'upload', image: uploaded });
    } else {
      if (!typed.trim()) return;
      onSubmit({ method: 'typed', typedText: typed.trim(), font: 'cursive' });
    }
  }

  const canSave =
    mode === 'draw' ? hasInk : mode === 'upload' ? !!uploaded : !!typed.trim();

  return (
    <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/40 p-3">
      <div className="flex gap-2">
        {(['draw', 'upload', 'typed'] as const).map((m) => (
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
            {m === 'draw'
              ? t('signatures.draw', 'Draw')
              : m === 'upload'
                ? t('signatures.upload', 'Upload')
                : t('signatures.type', 'Type')}
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
            {t('signatures.clear', 'Clear')}
          </button>
        </div>
      ) : mode === 'upload' ? (
        <div className="space-y-1.5">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
          />
          {uploadError && <p className="text-xs text-error">{uploadError}</p>}
          {uploaded && (
            <img
              src={uploaded}
              alt={t('signatures.uploadedAlt', 'Uploaded signature')}
              className="h-16 rounded border border-border bg-white object-contain"
            />
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('signatures.typeNamePlaceholder', 'Type your name')}
          />
          <div className="flex h-14 items-center rounded border border-border bg-white px-3">
            <span
              className="text-2xl text-gray-900"
              style={{ fontFamily: 'cursive' }}
            >
              {typed || t('signatures.preview', 'Preview')}
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" isLoading={saving} disabled={!canSave} onClick={submit}>
          {submitLabel ?? t('signatures.save', 'Save signature')}
        </Button>
      </div>
    </div>
  );
}
