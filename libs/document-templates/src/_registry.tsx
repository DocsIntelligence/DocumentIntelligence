import type { ComponentType } from 'react';
import type { PageSizeKey } from './_internals/page-sizes';
import { RentAgreementClassic } from './rent-agreement/classic';
import { RtiDefault } from './rti/default';
import { LegalNoticeFormal } from './legal-notice/formal';
import { AffidavitDefault } from './affidavit/default';
import { FreeformDocument } from './freeform';

/**
 * Maps template `componentKey` (as stored on DocumentTemplate) to the
 * React component. The artboard and Puppeteer renderer both go through
 * this registry. New templates must add themselves here.
 */

export interface TemplateProps<TData = unknown> {
  data: TData;
  pageSize: PageSizeKey;
}

export type TemplateComponent<TData = unknown> = ComponentType<
  TemplateProps<TData>
>;

const registry: Record<string, TemplateComponent<unknown>> = {
  'rent-agreement.classic': RentAgreementClassic as TemplateComponent<unknown>,
  // Bilingual variant currently aliases to classic until the dedicated
  // component lands. Replace when the bilingual template is implemented.
  'rent-agreement.bilingual':
    RentAgreementClassic as TemplateComponent<unknown>,
  // RTI application (Right to Information Act, 2005). Both en/hi seed templates
  // currently map to the same component.
  'rti.default': RtiDefault as TemplateComponent<unknown>,
  // Pre-litigation legal notice (branches on noticeType, incl. NI Act §138).
  'legal-notice.formal': LegalNoticeFormal as TemplateComponent<unknown>,
  // General-purpose affidavit (deponent + numbered declarations + attestation).
  'affidavit.default': AffidavitDefault as TemplateComponent<unknown>,
  // Freeform / AI-drafted documents — editor HTML rendered to pages.
  freeform: FreeformDocument as TemplateComponent<unknown>,
};

export function getTemplate<TData = unknown>(
  componentKey: string,
): TemplateComponent<TData> | undefined {
  return registry[componentKey] as TemplateComponent<TData> | undefined;
}

export function listTemplateKeys(): string[] {
  return Object.keys(registry);
}
