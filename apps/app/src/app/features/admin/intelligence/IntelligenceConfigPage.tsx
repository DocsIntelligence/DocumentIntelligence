import { Card, Spinner } from '@org/ui';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/page-header';
import {
  CreateGroup,
  GroupEditor,
  LookupManager,
} from '../lookups/LookupManager';
import { useAdminGroup } from '../lookups/queries';
import { SearchSettingsManager } from '../search/SearchSettingsManager';
import {
  EntityKindsManager,
  VaultDocKindForm,
  VaultDocKindsManager,
  VaultEntityKindForm,
  VaultFieldForm,
  VaultFieldsManager,
} from '../vault/VaultConfigManager';
import {
  useVaultDocKinds,
  useVaultEntityKinds,
  useVaultFields,
} from '../vault/queries';
import { FieldMapEditor } from './FieldMapEditor';
import {
  blankPipeline,
  PipelineEditor,
  pipelineDetailToForm,
  PipelineManager,
} from './PipelineManager';
import {
  blankSchema,
  detailToForm,
  SchemaEditor,
  SchemaManager,
} from './SchemaManager';
import { usePipeline, useSchema } from './queries';

/**
 * Admin portal for Document-Intelligence config-as-data (docs/07 P4.2): author
 * document types + extraction fields, compose processing pipelines, and manage
 * lookups.
 *
 * Each concern is its own routed page (/config/{types,pipelines,
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
      <PageHeader back={false} title={title} subtitle={subtitle} />
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

export function SearchConfigPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('searchAdmin.title', 'Search settings')}
      subtitle={t(
        'searchAdmin.subtitle',
        'Tune hybrid keyword + semantic ranking, choose what is searchable, and rebuild the index.',
      )}
    >
      <SearchSettingsManager />
    </ConfigShell>
  );
}

/** `/config/vault` — Entity-kinds tab (the default landing). */
export function VaultConfigPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('vaultAdmin.title', 'Vault catalog')}
      subtitle={t(
        'vaultAdmin.entityKindsSubtitle',
        'Pick which entity kinds your Vault supports (Person, Lawyer, Court …) and which fields each one uses. Fields live in a shared global pool — Aadhaar is one row reused by every kind that needs it.',
      )}
    >
      <EntityKindsManager />
    </ConfigShell>
  );
}

export function VaultFieldsPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('vaultAdmin.title', 'Vault catalog')}
      subtitle={t(
        'vaultAdmin.fieldsSubtitle',
        'The canonical field pool — used by every entity kind via the field map. Stable keys keep document autofill working.',
      )}
    >
      <VaultFieldsManager />
    </ConfigShell>
  );
}

export function VaultDocKindsPage() {
  const { t } = useTranslation();
  return (
    <ConfigShell
      title={t('vaultAdmin.title', 'Vault catalog')}
      subtitle={t(
        'vaultAdmin.docKindsSubtitle',
        'Document kinds (Aadhaar, PAN, Sale deed …) that Vault entities can attach — each scannable kind autofills a defined set of canonical fields.',
      )}
    >
      <VaultDocKindsManager />
    </ConfigShell>
  );
}

/** Field-mapping page — own route so refresh + deep-link work. */
export function FieldMappingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { schemaKey } = useParams<{ schemaKey: string }>();
  if (!schemaKey) {
    navigate('/config/document-types', { replace: true });
    return null;
  }
  return (
    <ConfigShell
      title={t('adminIntel.map.title', 'Field mapping')}
      subtitle={t(
        'adminIntel.map.subtitle',
        'Map each extraction field to a path in the drafting document. Blank = not mapped.',
      )}
    >
      <FieldMapEditor
        schemaKey={schemaKey}
        onClose={() => navigate('/config/document-types')}
      />
    </ConfigShell>
  );
}

/** Create-a-new-type page. */
export function NewDocTypePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = () => navigate('/config/document-types');
  return (
    <ConfigShell
      title={t('adminIntel.schema.createTitle', 'New document type')}
      subtitle={t(
        'adminIntel.schema.createSubtitle',
        'Define a new extraction type — name, drafting key, fields, jurisdiction.',
      )}
    >
      <SchemaEditor initial={blankSchema()} creating onClose={goBack} />
    </ConfigShell>
  );
}

/**
 * Edit / clone page — shared because both load an existing schema as the form
 * source; cloning differs only in mode (`creating: true`) + reset key fields.
 */
function DocTypeEditOrClonePage({ clone }: { clone: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { schemaKey } = useParams<{ schemaKey: string }>();
  const goBack = () => navigate('/config/document-types');
  const { data: loaded, isLoading } = useSchema(schemaKey ?? null);

  if (!schemaKey) {
    navigate('/config/document-types', { replace: true });
    return null;
  }

  const title = clone
    ? t('adminIntel.schema.cloneTitle', 'Clone document type')
    : t('adminIntel.schema.editTitle', 'Edit document type');
  const subtitle = clone
    ? t(
        'adminIntel.schema.cloneSubtitle',
        'Mints a new type pre-filled from the source. Key + name must be unique.',
      )
    : t(
        'adminIntel.schema.editSubtitle',
        'Saving mints a new immutable version while keeping history.',
      );

  return (
    <ConfigShell title={title} subtitle={subtitle}>
      {isLoading || !loaded ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <SchemaEditor
          initial={detailToForm(loaded, clone)}
          creating={clone}
          onClose={goBack}
        />
      )}
    </ConfigShell>
  );
}

export function EditDocTypePage() {
  return <DocTypeEditOrClonePage clone={false} />;
}

export function CloneDocTypePage() {
  return <DocTypeEditOrClonePage clone={true} />;
}

// ── Pipelines ───────────────────────────────────────────────────────────

export function NewPipelinePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = () => navigate('/config/pipelines');
  return (
    <ConfigShell
      title={t('adminIntel.pipeline.createTitle', 'New pipeline')}
      subtitle={t(
        'adminIntel.pipeline.createSubtitle',
        'Compose an ordered set of stages (classify → review → extract → export).',
      )}
    >
      <PipelineEditor initial={blankPipeline()} creating onClose={goBack} />
    </ConfigShell>
  );
}

function PipelineEditOrClonePage({ clone }: { clone: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pipelineKey } = useParams<{ pipelineKey: string }>();
  const goBack = () => navigate('/config/pipelines');
  const { data: loaded, isLoading } = usePipeline(pipelineKey ?? null);
  if (!pipelineKey) {
    navigate('/config/pipelines', { replace: true });
    return null;
  }
  const title = clone
    ? t('adminIntel.pipeline.cloneTitle', 'Clone pipeline')
    : t('adminIntel.pipeline.editTitle', 'Edit pipeline');
  const subtitle = clone
    ? t(
        'adminIntel.pipeline.cloneSubtitle',
        'Pre-filled from the source — key + name must be unique.',
      )
    : t(
        'adminIntel.pipeline.editSubtitle',
        'Saving mints a new immutable version while keeping history.',
      );
  return (
    <ConfigShell title={title} subtitle={subtitle}>
      {isLoading || !loaded ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <PipelineEditor
          initial={pipelineDetailToForm(loaded, clone)}
          creating={clone}
          onClose={goBack}
        />
      )}
    </ConfigShell>
  );
}

export function EditPipelinePage() {
  return <PipelineEditOrClonePage clone={false} />;
}

export function ClonePipelinePage() {
  return <PipelineEditOrClonePage clone={true} />;
}

// ── Lookups ─────────────────────────────────────────────────────────────

export function NewLookupGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = () => navigate('/config/lookups');
  return (
    <ConfigShell
      title={t('adminLookups.newTitle', 'New lookup group')}
      subtitle={t(
        'adminLookups.newSubtitle',
        'A new option-set the document forms can pull dropdown values from.',
      )}
    >
      <CreateGroup onClose={goBack} />
    </ConfigShell>
  );
}

// ── Vault config (fields + doc kinds) ───────────────────────────────────

/** Routed create-page for a new entity kind. */
export function NewVaultEntityKindPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = () => navigate('/config/vault');
  return (
    <ConfigShell
      title={t('vaultAdmin.addKindTitle', 'Add entity kind')}
      subtitle={t(
        'vaultAdmin.addKindSubtitle',
        'Define a new kind of Vault entity (e.g. "Witness", "Notary"). Once saved you can map fields to it.',
      )}
    >
      <VaultEntityKindForm initial={{ isActive: true }} onClose={goBack} />
    </ConfigShell>
  );
}

/** Routed edit-page for an entity kind — includes the field-map editor. */
export function EditVaultEntityKindPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kindId } = useParams<{ kindId: string }>();
  const goBack = () => navigate('/config/vault');
  const { data: allKinds, isLoading } = useVaultEntityKinds();
  if (!kindId) {
    navigate('/config/vault', { replace: true });
    return null;
  }
  const kind = allKinds?.find((k) => k.id === kindId);
  return (
    <ConfigShell
      title={t('vaultAdmin.editKindTitle', 'Edit entity kind')}
      subtitle={t(
        'vaultAdmin.editKindSubtitle',
        'Update label, badge colour, and which fields this kind exposes.',
      )}
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : kind ? (
        <VaultEntityKindForm initial={kind} onClose={goBack} />
      ) : (
        <p className="text-sm text-foreground/60">
          {t('vaultAdmin.kindNotFound', 'Entity kind not found.')}
        </p>
      )}
    </ConfigShell>
  );
}

export function NewVaultFieldPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = () => navigate('/config/vault/fields');
  return (
    <ConfigShell
      title={t('vaultAdmin.addField', 'Add field')}
      subtitle={t(
        'vaultAdmin.addFieldSubtitle',
        'Add a new canonical field to the global pool. Any entity kind can then link to it.',
      )}
    >
      <VaultFieldForm initial={{ type: 'text' }} onClose={goBack} />
    </ConfigShell>
  );
}

export function EditVaultFieldPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fieldId } = useParams<{ fieldId: string }>();
  const goBack = () => navigate('/config/vault/fields');
  const { data: all, isLoading } = useVaultFields();
  if (!fieldId) {
    navigate('/config/vault/fields', { replace: true });
    return null;
  }
  const field = all?.find((f) => f.id === fieldId);
  return (
    <ConfigShell
      title={t('vaultAdmin.editField', 'Edit field')}
      subtitle={t(
        'vaultAdmin.editFieldSubtitle',
        'Update label, type, group, and sensitivity. The stable key cannot change.',
      )}
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : field ? (
        <VaultFieldForm initial={field} onClose={goBack} />
      ) : (
        <p className="text-sm text-foreground/60">
          {t('vaultAdmin.fieldNotFound', 'Field not found.')}
        </p>
      )}
    </ConfigShell>
  );
}

export function NewVaultDocKindPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const goBack = () => navigate('/config/vault');
  const { data: allFields } = useVaultFields();
  return (
    <ConfigShell
      title={t('vaultAdmin.addDocKind', 'Add document kind')}
      subtitle={t(
        'vaultAdmin.addDocKindSubtitle',
        'A new document kind for entities (e.g. PAN, Aadhaar) — picks which fields it autofills.',
      )}
    >
      <VaultDocKindForm
        initial={{ scannable: true }}
        allFields={allFields ?? []}
        onClose={goBack}
      />
    </ConfigShell>
  );
}

export function EditVaultDocKindPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { kindId } = useParams<{ kindId: string }>();
  const goBack = () => navigate('/config/vault');
  const { data: allKinds, isLoading } = useVaultDocKinds();
  const { data: allFields } = useVaultFields();
  if (!kindId) {
    navigate('/config/vault', { replace: true });
    return null;
  }
  const kind = allKinds?.find((k) => k.id === kindId);
  return (
    <ConfigShell
      title={t('vaultAdmin.editDocKind', 'Edit document kind')}
      subtitle={t(
        'vaultAdmin.editDocKindSubtitle',
        'Update label, scannability, and which canonical fields it fills.',
      )}
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : kind ? (
        <VaultDocKindForm
          initial={kind}
          allFields={allFields ?? []}
          onClose={goBack}
        />
      ) : (
        <p className="text-sm text-foreground/60">
          {t('vaultAdmin.docKindNotFound', 'Document kind not found.')}
        </p>
      )}
    </ConfigShell>
  );
}

export function EditLookupGroupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const goBack = () => navigate('/config/lookups');
  const groupQuery = useAdminGroup(groupId ?? null);
  if (!groupId) {
    navigate('/config/lookups', { replace: true });
    return null;
  }
  return (
    <ConfigShell
      title={t('adminLookups.editTitle', 'Edit lookup group')}
      subtitle={t(
        'adminLookups.editSubtitle',
        'Manage the values, rename, and toggle visibility.',
      )}
    >
      {groupQuery.isLoading || !groupQuery.data ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : (
        <GroupEditor group={groupQuery.data} onClose={goBack} />
      )}
    </ConfigShell>
  );
}

export default DocTypesPage;
