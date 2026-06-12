import type { ComponentType } from 'react';
import type { PageSizeKey } from './_internals/page-sizes';
import { RentAgreementClassic } from './rent-agreement/classic';
import { RtiDefault } from './rti/default';
import { LegalNoticeFormal } from './legal-notice/formal';
import { AffidavitDefault } from './affidavit/default';
import { NdaStandard } from './nda/standard';
import { PromissoryNoteStandard } from './promissory-note/standard';
import { EmploymentOfferStandard } from './employment-offer/standard';
import { PowerOfAttorneyStandard } from './power-of-attorney/standard';
import { InvoiceStandard } from './invoice/standard';
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
  // Non-disclosure agreement (mutual/one-way; Indian Contract Act, 1872).
  'nda.standard': NdaStandard as TemplateComponent<unknown>,
  // Promissory note (NI Act §4; revenue-stamped, not eSignable).
  'promissory-note.standard':
    PromissoryNoteStandard as TemplateComponent<unknown>,
  // Employment offer letter (India + global; currency + at-will aware).
  'employment-offer.standard':
    EmploymentOfferStandard as TemplateComponent<unknown>,
  // Power of attorney (general/special; not eSignable, IT Act Schedule 1).
  'power-of-attorney.standard':
    PowerOfAttorneyStandard as TemplateComponent<unknown>,
  // Tax invoice (GST/single/none, multi-currency, computed totals).
  'invoice.standard': InvoiceStandard as TemplateComponent<unknown>,
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
