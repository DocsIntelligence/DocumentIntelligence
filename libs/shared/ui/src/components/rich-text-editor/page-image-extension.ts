import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

/**
 * A full-page image node (e.g. a scanned E-Stamp certificate or ID proof)
 * inserted between two page breaks so it occupies its own page — see
 * `TemplateEditor.handleInsertPageImage`. Block-level (not inline) so the
 * shared paginator (`paginate-html.ts`) treats it as one atomic top-level
 * block, same as it already does for any other image.
 */
export const PageImageExtension = Image.extend({
  inline: false,

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(HTMLAttributes, {
        'data-page-image': '',
        class: 'editor-page-image',
      }),
    ];
  },
});
