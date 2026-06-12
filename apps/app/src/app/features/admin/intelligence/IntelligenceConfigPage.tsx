import { Card } from '@org/ui';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LookupManager } from '../lookups/LookupManager';
import { PipelineManager } from './PipelineManager';
import { SchemaManager } from './SchemaManager';

/**
 * Admin portal for Document-Intelligence config-as-data (docs/07 P4.2): author
 * document types + extraction fields, compose processing pipelines, and manage
 * lookups.
 *
 * Each concern is its own routed page (/admin/intelligence/{types,pipelines,
 * lookups}) reached from the sidebar — no in-page tab strip. Each page renders
 * its own titled shell.
 *
 * NOTE: temporarily open to any authenticated user (the admin role-gate was
 * removed for now). Re-add a `user?.role !== 'admin'` guard to lock it down.
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
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="text-foreground/60 mt-1">{subtitle}</p>
      </div>
      <Card className="rounded-xl p-6">{children}</Card>
    </div>
  );
}

export function DocTypesPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('adminIntel.types.title', 'Document types & fields')}
      subtitle={t(
        'adminIntel.types.subtitle',
        'Define the document types and the fields extracted from each — no code.',
      )}
    >
      <SchemaManager />
    </ConfigShell>
  );
}

export function PipelinesPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('adminIntel.pipelines.title', 'Pipelines')}
      subtitle={t(
        'adminIntel.pipelines.subtitle',
        'Design the classify → extract → review → export flow for each document type.',
      )}
    >
      <PipelineManager />
    </ConfigShell>
  );
}

export function LookupsPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('adminIntel.lookups.title', 'Lookups')}
      subtitle={t(
        'adminIntel.lookups.subtitle',
        'Manage the dropdown option-sets used across document forms.',
      )}
    >
      <LookupManager />
    </ConfigShell>
  );
}

export default DocTypesPage;
