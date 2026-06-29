import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { TemplateEditor, type EditorDraftState } from './TemplateEditor';
import { useCreateDocument } from '../documents/queries';
import { useLegalAiService } from '../documents/services-context';

/**
 * The `/editor` scratchpad: a freeform draft kept in localStorage until the
 * user chooses "Save to my documents", which promotes it to a backend
 * `freeform` Document and switches to the persisted editor at
 * `/documents/:id/draft`.
 */
export function EditorDemo() {
  const create = useCreateDocument();
  const navigate = useNavigate();
  const legalAi = useLegalAiService();
  const [params] = useSearchParams();
  // Filed into a group when the editor was opened from one (?groupId=…).
  const groupId = params.get('groupId') ?? undefined;

  const handleAiGenerate = useCallback(
    async (brief: string, language: string) => {
      const r = await legalAi.generate({
        brief,
        language,
        documentTypeKey: 'freeform',
      });
      return { html: r.html, disclaimer: r.disclaimer };
    },
    [legalAi],
  );

  const handleAiRevise = useCallback(
    async (instruction: string, html: string, language?: string) => {
      const r = await legalAi.revise({ instruction, html, language });
      return { html: r.html };
    },
    [legalAi],
  );

  const handleSaveToCloud = useCallback(
    async (s: EditorDraftState) => {
      const doc = await create.mutateAsync({
        title: s.title || 'Untitled document',
        documentTypeKey: 'freeform',
        templateKey: 'freeform',
        data: { html: s.html, values: s.values, templateId: s.templateId },
        groupId,
      });
      toast.success('Saved to your documents');
      navigate(`/documents/${doc.id}/draft`);
    },
    [create, navigate, groupId],
  );

  return (
    <TemplateEditor
      backHref="/documents"
      onSaveToCloud={handleSaveToCloud}
      savingToCloud={create.isPending}
      onAiGenerate={handleAiGenerate}
      onAiRevise={handleAiRevise}
    />
  );
}
