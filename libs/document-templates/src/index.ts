export { Page, PagePrintStyles } from './_internals/Page';
export { Paginator } from './_internals/Paginator';
export { StampPaperFrame } from './_internals/StampPaperFrame';
export {
  pageProfiles,
  isStampPaper,
  type PageSizeKey,
  type PageProfile,
} from './_internals/page-sizes';
export { EditableField } from './_internals/EditableField';
export {
  EditContextProvider,
  useEditContext,
  type EditableWidget,
  type FieldClickEvent,
} from './_internals/edit-context';

export {
  getTemplate,
  listTemplateKeys,
  type TemplateComponent,
  type TemplateProps,
} from './_registry';
export { TemplateRenderer } from './TemplateRenderer';

export { RentAgreementClassic } from './rent-agreement/classic';
export { FreeformDocument, type FreeformData } from './freeform';
