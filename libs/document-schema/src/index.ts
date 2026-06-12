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
