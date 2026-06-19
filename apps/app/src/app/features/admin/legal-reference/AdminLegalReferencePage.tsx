import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PageHeader,
  type PageHeaderAction,
} from '../../../components/page-header';
import { CitationEditor } from './CitationEditor';
import { LegalReferenceManager } from './LegalReferenceManager';
import { ReformLookup } from './ReformLookup';

/**
 * Shared shell — matches the look of every other admin page
 * (IntelligenceConfigPage / VaultConfigManager / LookupManager).
 */
function ConfigShell({
  title,
  subtitle,
  back = false,
  secondaryActions,
  children,
}: {
  title: string;
  subtitle: string;
  back?: boolean;
  secondaryActions?: PageHeaderAction[];
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        back={back}
        title={title}
        subtitle={subtitle}
        secondaryActions={secondaryActions}
      />
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
      secondaryActions={[
        {
          label: t('reform.lookupAction', '2024 reform lookup'),
          to: '/config/legal-reference/reform',
        },
      ]}
    >
      <LegalReferenceManager />
    </ConfigShell>
  );
}

/** /config/legal-reference/reform — old→new criminal-code diff / lookup tool. */
export function ReformLookupPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      back
      title={t('reform.title', 'Criminal-law reform lookup')}
      subtitle={t(
        'reform.subtitle',
        'Old IPC / CrPC / Indian Evidence Act references → their BNS / BNSS / BSA successors (effective 1 Jul 2024).',
      )}
    >
      <ReformLookup />
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
