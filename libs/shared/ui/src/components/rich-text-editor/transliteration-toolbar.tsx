import {
  SUPPORTED_LANGUAGES,
  useTransliteration,
  type SupportedLanguage,
} from '@org/transliteration';
import { cn } from '@org/utils';

import { Button } from '../button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu';
import { Tooltip } from '../tooltip';

export type TransliterationToolbarProps = {
  className?: string;
};

export function TransliterationToolbar({
  className,
}: TransliterationToolbarProps) {
  const { enabled, toggle, language, setLanguage, languages } =
    useTransliteration();

  const currentLang = languages[language];

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Tooltip
        content={
          enabled
            ? 'Disable transliteration'
            : 'Enable transliteration (type in English, get Indic script)'
        }
      >
        <Button
          variant={enabled ? 'primary' : 'outline'}
          size="sm"
          onClick={toggle}
          className="gap-1.5 text-xs"
        >
          <span className="text-sm">अ</span>
          <span className="hidden sm:inline">{enabled ? 'On' : 'Off'}</span>
        </Button>
      </Tooltip>

      <DropdownMenu>
        <Tooltip content="Select transliteration language">
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <span>{currentLang.nativeName}</span>
              <svg
                className="size-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          <DropdownMenuLabel>Language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, lang]) => (
            <DropdownMenuItem
              key={code}
              onClick={() => setLanguage(code as SupportedLanguage)}
              className={cn(
                'gap-2',
                code === language && 'bg-primary/50 text-primary',
              )}
            >
              <span className="min-w-16 text-sm">{lang.nativeName}</span>
              <span className="text-xs text-foreground/60">{lang.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
