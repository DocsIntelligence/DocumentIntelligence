import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../components/page-header';
import { CitationEditor } from './CitationEditor';
import { LegalReferenceManager } from './LegalReferenceManager';

/**
 * Shared shell — matches the look of every other admin page
 * (IntelligenceConfigPage / VaultConfigManager / LookupManager).
 */
function ConfigShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader back={false} title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

/** /config/legal-reference — citation catalog list. */
export function AdminLegalReferencePage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('legalRefs.adminTitle', 'Legal reference catalog')}
      subtitle={t(
        'legalRefs.adminSubtitle',
        'Curated statutes referenced by AI-drafted documents + the public /law catalog. Narrower wins: DB row overrides code seed.',
      )}
    >
      <LegalReferenceManager />
    </ConfigShell>
  );
}

/** /config/legal-reference/new */
export function NewCitationPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('legalRefs.newTitle', 'New citation')}
      subtitle={t(
        'legalRefs.newSubtitle',
        'Pick a stable id (e.g. ni.138), fill the act + section + summary, optionally set drafting tips for the public page.',
      )}
    >
      <CitationEditor mode="new" />
    </ConfigShell>
  );
}

/** /config/legal-reference/:id/edit */
export function EditCitationPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('legalRefs.editTitle', 'Edit citation')}
      subtitle={t(
        'legalRefs.editSubtitle',
        'Update the curated summary + drafting tips. The id cannot be changed — clone instead if you need a different one.',
      )}
    >
      <CitationEditor mode="edit" />
    </ConfigShell>
  );
}

/** /config/legal-reference/:id/clone */
export function CloneCitationPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('legalRefs.cloneTitle', 'Duplicate citation')}
      subtitle={t(
        'legalRefs.cloneSubtitle',
        'Pre-filled with `_copy` suffix. Pick a new id before saving.',
      )}
    >
      <CitationEditor mode="clone" />
    </ConfigShell>
  );
}

export default AdminLegalReferencePage;
