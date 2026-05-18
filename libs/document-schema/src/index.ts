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

export { rentAgreementBundle } from './rent-agreement';
export type { RentAgreementData, Party } from './rent-agreement/schema';
