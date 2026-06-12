export * from './types';
export {
  getBundle,
  requireBundle,
  listRegisteredKeys,
  registerDocumentType,
} from './_registry';

// Eagerly register all known document types. Adding a new doc type means
// importing it here.
import './rent-agreement';
import './rti';
import './legal-notice';
import './affidavit';
import './nda';
import './promissory-note';
import './employment-offer';
import './power-of-attorney';
import './invoice';
import './receipt';
import './quotation';
import './purchase-order';
import './credit-note';
import './payslip';
import './will';

export { rentAgreementBundle } from './rent-agreement';
export type { RentAgreementData, Party } from './rent-agreement/schema';

export { rtiBundle } from './rti';
export type { RtiApplicationData } from './rti/schema';

export { legalNoticeBundle } from './legal-notice';
export type { LegalNoticeData } from './legal-notice/schema';

export { affidavitBundle } from './affidavit';
export type { AffidavitData } from './affidavit/schema';

export { ndaBundle } from './nda';
export type { NdaData, NdaParty } from './nda/schema';

export { promissoryNoteBundle } from './promissory-note';
export type {
  PromissoryNoteData,
  PromissoryParty,
} from './promissory-note/schema';

export { employmentOfferBundle } from './employment-offer';
export type { EmploymentOfferData } from './employment-offer/schema';

export { powerOfAttorneyBundle } from './power-of-attorney';
export type { PowerOfAttorneyData } from './power-of-attorney/schema';

export { invoiceBundle } from './invoice';
export type { InvoiceData, InvoiceItem } from './invoice/schema';

export { receiptBundle } from './receipt';
export type { ReceiptData } from './receipt/schema';

export { quotationBundle } from './quotation';
export type { QuotationData } from './quotation/schema';

export { purchaseOrderBundle } from './purchase-order';
export type { PurchaseOrderData } from './purchase-order/schema';

export { creditNoteBundle } from './credit-note';
export type { CreditNoteData } from './credit-note/schema';

export { payslipBundle } from './payslip';
export type { PayslipData, PayComponent } from './payslip/schema';

export { willBundle } from './will';
export type { WillData, Bequest, Witness } from './will/schema';
