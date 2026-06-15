import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@org/ui';
import { DocumentInsights } from '../intelligence/DocumentInsights';
import { CitationHealth } from './CitationHealth';
import { AiUsageSummary } from '../admin/ai-usage/AiUsageSummary';

interface Props {
  documentId: string;
}

/**
 * Side panel for any drafting document. Three concerns share the same
 * narrow column, so they live behind a single segmented control — one view
 * at a time, no stacking, no nested collapsibles. New surfaces (analytics,
 * retention…) get added as additional tabs here, not as another section.
 *
 * Default tab is **Citations** because it's the only tab with actions; the
 * other two are read-mostly status views.
 */
export function DocumentSidePanel({ documentId }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'citations' | 'insights' | 'usage'>(
    'citations',
  );

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as typeof tab)}
      className="flex flex-col h-full"
    >
      <TabsList
        className="m-2 grid grid-cols-3"
      >
        <TabsTrigger value="citations" className="text-xs">
          {t('sidePanel.tabCitations', 'Citations')}
        </TabsTrigger>
        <TabsTrigger value="insights" className="text-xs">
          {t('sidePanel.tabInsights', 'Insights')}
        </TabsTrigger>
        <TabsTrigger value="usage" className="text-xs">
          {t('sidePanel.tabUsage', 'Usage')}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="citations"
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
      >
        <CitationHealth documentId={documentId} />
      </TabsContent>
      <TabsContent
        value="insights"
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
      >
        <DocumentInsights sourceId={documentId} scope="document" />
      </TabsContent>
      <TabsContent
        value="usage"
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3"
      >
        <AiUsageSummary scope={{ kind: 'document', id: documentId }} />
      </TabsContent>
    </Tabs>
  );
}

export default DocumentSidePanel;
