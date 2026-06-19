import type { ComponentType } from 'react';
import type { PageSizeKey } from './_internals/page-sizes';
import { RentAgreementClassic } from './rent-agreement/classic';
import { RtiDefault } from './rti/default';
import { LegalNoticeFormal } from './legal-notice/formal';
import { ChequeBounceFormal } from './cheque-bounce-notice/formal';
import { ConsumerComplaintStandard } from './consumer-complaint/standard';
import { AnticipatoryBailStandard } from './anticipatory-bail/standard';
import { AffidavitDefault } from './affidavit/default';
import { NdaStandard } from './nda/standard';
import { PromissoryNoteStandard } from './promissory-note/standard';
import { EmploymentOfferStandard } from './employment-offer/standard';
import { PowerOfAttorneyStandard } from './power-of-attorney/standard';
import { InvoiceStandard } from './invoice/standard';
import { ReceiptStandard } from './receipt/standard';
import { QuotationStandard } from './quotation/standard';
import { PurchaseOrderStandard } from './purchase-order/standard';
import { CreditNoteStandard } from './credit-note/standard';
import { PayslipStandard } from './payslip/standard';
import { WillStandard } from './will/standard';
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
  // Dedicated §138 cheque-bounce demand notice (payee/drawer/cheque timeline).
  'cheque-bounce.formal': ChequeBounceFormal as TemplateComponent<unknown>,
  // CPA 2019 consumer complaint (forum-branched filing section; pecuniary jurisdiction).
  'consumer-complaint.standard': ConsumerComplaintStandard as TemplateComponent<unknown>,
  // BNSS §482 anticipatory-bail application (Sessions / High Court; apprehension + grounds).
  'anticipatory-bail.standard': AnticipatoryBailStandard as TemplateComponent<unknown>,
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
  // Payment receipt ("received with thanks…", amount in words, balance).
  'receipt.standard': ReceiptStandard as TemplateComponent<unknown>,
  // Quotation / estimate (invoice engine; valid-until, no payment).
  'quotation.standard': QuotationStandard as TemplateComponent<unknown>,
  // Purchase order (buyer→vendor; invoice engine; required-by, ship-to).
  'purchase-order.standard':
    PurchaseOrderStandard as TemplateComponent<unknown>,
  // Credit / debit note (invoice engine; references the original invoice).
  'credit-note.standard': CreditNoteStandard as TemplateComponent<unknown>,
  // Payslip / salary slip (earnings − deductions = net, in words).
  'payslip.standard': PayslipStandard as TemplateComponent<unknown>,
  // Last will & testament (Schedule-1: not eSignable; two witnesses).
  'will.standard': WillStandard as TemplateComponent<unknown>,
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
