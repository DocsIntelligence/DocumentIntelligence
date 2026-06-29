import { Card } from '@org/ui';
import { cn } from '@org/utils';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * New-document hub: three clear ways to start, each its own page. Structured
 * templates are now top-level (/documents/templates) rather than buried.
 *
 * When opened from inside a group (`?groupId=…`), the context is forwarded to
 * each create flow so the resulting document is filed into that group.
 */
export function NewDocumentPicker() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const groupId = params.get('groupId');
  const withGroup = (to: string) =>
    groupId ? `${to}${to.includes('?') ? '&' : '?'}groupId=${groupId}` : to;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t('common.newDocument', 'New document')}
        </h1>
        <p className="mt-1 text-foreground/60">
          {t(
            'newDoc.hubSubtitle',
            'Start with AI, pick a structured template, or open a blank editor.',
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ChoiceCard
          to={withGroup("/documents/draft-ai")}
          accent
          badge="AI"
          title={t('dashboard.draftAiTitle', 'Draft with AI')}
          desc={t(
            'newDoc.draftAiCardDesc',
            'Describe what you need in plain English and let AI draft the full document. Review and edit before use.',
          )}
        />
        <ChoiceCard
          to={withGroup("/documents/templates")}
          badge={t('newDoc.structuredBadge', 'Structured')}
          title={t('templates.title', 'Templates')}
          desc={t(
            'newDoc.templatesCardDesc',
            'Start from a structured document type — guided fields and the right format.',
          )}
        />
        <ChoiceCard
          to={withGroup("/editor")}
          badge={t('newDoc.freeformBadge', 'Freeform')}
          title={t('newDoc.blankTitle', 'Blank document')}
          desc={t(
            'newDoc.blankCardDesc',
            'Open the rich-text editor and write from scratch, with transliteration, placeholders and page breaks.',
          )}
        />
        <ChoiceCard
          to={withGroup("/editor/markdown")}
          badge={t('newDoc.markdownBadge', 'Markdown')}
          title={t('newDoc.markdownTitle', 'Markdown document')}
          desc={t(
            'newDoc.markdownCardDesc',
            'Write in Markdown with a live split preview, then save it to your documents.',
          )}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  to,
  badge,
  title,
  desc,
  accent,
}: {
  to: string;
  badge: string;
  title: string;
  desc: string;
  accent?: boolean;
}) {
  return (
    <Link to={to} className="group block">
      <Card
        className={cn(
          'h-full space-y-2 rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md',
          accent
            ? 'border-primary/40 bg-primary/5 hover:border-primary/50'
            : 'hover:border-primary/40',
        )}
      >
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-wide',
            accent ? 'text-primary' : 'text-foreground/50',
          )}
        >
          {badge}
        </span>
        <h3 className="font-semibold text-foreground group-hover:text-primary">
          {title}
        </h3>
        <p className="text-sm text-foreground/60">{desc}</p>
      </Card>
    </Link>
  );
}

export default NewDocumentPicker;
