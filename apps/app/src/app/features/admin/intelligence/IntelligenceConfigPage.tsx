import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from '@org/ui';
import { useTranslation } from 'react-i18next';
import { PipelineManager } from './PipelineManager';
import { SchemaManager } from './SchemaManager';

/**
 * Admin portal for Document-Intelligence config-as-data (docs/07 P4.2): author
 * document types + extraction fields, and compose processing pipelines.
 *
 * NOTE: temporarily open to any authenticated user (the admin role-gate was
 * removed for now). Re-add a `user?.role !== 'admin'` guard to lock it down.
 */
export function IntelligenceConfigPage() {
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

      <Tabs defaultValue="schemas">
        <TabsList>
          <TabsTrigger value="schemas">
            {t('adminIntel.tabs.schemas', 'Document types & fields')}
          </TabsTrigger>
          <TabsTrigger value="pipelines">
            {t('adminIntel.tabs.pipelines', 'Pipelines')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="schemas">
          <Card className="rounded-xl p-6">
            <SchemaManager />
          </Card>
        </TabsContent>
        <TabsContent value="pipelines">
          <Card className="rounded-xl p-6">
            <PipelineManager />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default IntelligenceConfigPage;
