import { Button } from '@org/ui';
import { useMutation } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useIntelligenceService } from '../documents/services-context';
import { FileTextIcon } from './icons';

/**
 * "View original" — opens the original uploaded file in a new tab via a
 * freshly-minted presigned URL (fetched on click, since presigned links
 * expire). Used in the review screen and on documents converted from a batch
 * run, so the source can always be compared against the extraction/draft.
 */
export function ViewOriginalButton({
  sourceId,
  size = 'sm',
  variant = 'outline',
}: {
  sourceId: string;
  size?: ComponentProps<typeof Button>['size'];
  variant?: ComponentProps<typeof Button>['variant'];
}) {
  const { t } = useTranslation();
  const svc = useIntelligenceService();
  const open = useMutation({
    mutationFn: () => svc.getOriginalUrl(sourceId),
    onSuccess: ({ url }) => window.open(url, '_blank', 'noopener,noreferrer'),
    onError: () =>
      toast.error(
        t('intelligence.original.failed', 'Could not open the original file.'),
      ),
  });
  return (
    <Button
      variant={variant}
      size={size}
      disabled={open.isPending}
      onClick={() => open.mutate()}
      className="gap-1.5"
    >
      <FileTextIcon className="size-3.5" />
      {t('intelligence.original.view', 'View original')}
    </Button>
  );
}
