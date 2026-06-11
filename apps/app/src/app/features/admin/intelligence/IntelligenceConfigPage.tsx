import { Card } from '@org/ui';
import { cn } from '@org/utils';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { PipelineManager } from './PipelineManager';
import { SchemaManager } from './SchemaManager';

/**
 * Admin portal for Document-Intelligence config-as-data (docs/07 P4.2): author
 * document types + extraction fields, and compose processing pipelines.
 *
 * Split into two routed pages (/admin/intelligence/{types,pipelines}) that share
 * a header + sub-nav, so each is independently linkable from the sidebar.
 *
 * NOTE: temporarily open to any authenticated user (the admin role-gate was
 * removed for now). Re-add a `user?.role !== 'admin'` guard to lock it down.
 */
function ConfigShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">
          {t('adminIntel.title', 'Document Intelligence configuration')}
        </h2>
        <p className="text-foreground/60 mt-1">
          {t(
            'adminIntel.subtitle',
            'Define document types and fields, and design the classify → extract → review → export flow — no code.',
          )}
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-lg border border-border bg-secondary/30 p-1">
        <SubNavLink to="/admin/intelligence/types">
          {t('adminIntel.tabs.schemas', 'Document types & fields')}
        </SubNavLink>
        <SubNavLink to="/admin/intelligence/pipelines">
          {t('adminIntel.tabs.pipelines', 'Pipelines')}
        </SubNavLink>
      </div>

      <Card className="rounded-xl p-6">{children}</Card>
    </div>
  );
}

function SubNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-background text-foreground shadow-sm'
            : 'text-foreground/60 hover:text-foreground',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function DocTypesPage() {
  return (
    <ConfigShell>
      <SchemaManager />
    </ConfigShell>
  );
}

export function PipelinesPage() {
  return (
    <ConfigShell>
      <PipelineManager />
    </ConfigShell>
  );
}

export default DocTypesPage;
