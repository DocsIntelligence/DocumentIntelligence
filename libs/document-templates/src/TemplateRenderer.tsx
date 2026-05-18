import { getTemplate, type TemplateProps } from './_registry';
import {
  EditContextProvider,
  type FieldClickEvent,
} from './_internals/edit-context';

interface RendererProps<T = unknown> extends TemplateProps<T> {
  componentKey: string;
  /** When true, EditableField nodes inside the template become clickable. */
  editable?: boolean;
  onFieldClick?: (e: FieldClickEvent) => void;
}

/**
 * Thin wrapper: takes the DocumentTemplate.componentKey, looks up the
 * React component, and renders it with the supplied data + pageSize.
 *
 * Used by:
 *   - apps/artboard live preview (postMessage drives props, editable=true)
 *   - apps/artboard /render/:key route (Puppeteer, editable=false)
 *   - apps/web /share/[token] public preview (editable=false)
 */
export function TemplateRenderer<T = unknown>({
  componentKey,
  data,
  pageSize,
  editable = false,
  onFieldClick,
}: RendererProps<T>) {
  const C = getTemplate<T>(componentKey);
  if (!C) {
    return (
      <div
        role="alert"
        style={{ padding: 24, fontFamily: 'system-ui', color: '#991b1b' }}
      >
        Unknown template: <code>{componentKey}</code>
      </div>
    );
  }
  return (
    <EditContextProvider editable={editable} onFieldClick={onFieldClick}>
      <C data={data} pageSize={pageSize} />
    </EditContextProvider>
  );
}
