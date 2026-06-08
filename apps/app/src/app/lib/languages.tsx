import { SUPPORTED_LANGUAGES } from '@org/transliteration';
import { cn } from '@org/utils';

export interface LanguageOption {
  /** Human language NAME sent to the AI (e.g. "Hindi"). */
  value: string;
  label: string;
}

const indian: LanguageOption[] = Object.values(SUPPORTED_LANGUAGES).map((l) => ({
  value: l.name,
  label: `${l.name} (${l.nativeName})`,
}));

/** English + India's languages + a few world languages. The AI can write any
 * language, so this is a convenience list — extend freely. */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'English', label: 'English' },
  ...indian,
  { value: 'Spanish', label: 'Spanish (Español)' },
  { value: 'French', label: 'French (Français)' },
  { value: 'German', label: 'German (Deutsch)' },
  { value: 'Portuguese', label: 'Portuguese (Português)' },
  { value: 'Chinese (Simplified)', label: 'Chinese (简体中文)' },
];

export const DEFAULT_LANGUAGE = 'English';

/** Native, dialog-safe language picker. */
export function LanguageSelect({
  value,
  onChange,
  id,
  includeKeepOption,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  /** Prepend a "Keep current language" option (value ""). For translate flows. */
  includeKeepOption?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 w-full rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40',
        className,
      )}
    >
      {includeKeepOption && <option value="">Keep current language</option>}
      {LANGUAGE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
