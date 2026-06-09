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

export { rentAgreementBundle } from './rent-agreement';
export type { RentAgreementData, Party } from './rent-agreement/schema';

export { rtiBundle } from './rti';
export type { RtiApplicationData } from './rti/schema';

export { legalNoticeBundle } from './legal-notice';
export type { LegalNoticeData } from './legal-notice/schema';

export { affidavitBundle } from './affidavit';
export type { AffidavitData } from './affidavit/schema';
