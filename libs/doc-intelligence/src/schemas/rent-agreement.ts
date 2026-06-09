/**
 * Rent-agreement ExtractionSchema — the first pack (docs/05 §5.5, §11.4),
 * co-designed with `@org/document-schema`'s `rentAgreementBundle` so a reviewed
 * extraction maps cleanly onto the structured builder on convert.
 *
 * Extraction keys are deliberately flat + human-readable (`landlord_name`); the
 * FieldMap translates them onto the bundle's nested Zod paths
 * (`parties.landlord.name`). This demonstrates the §11.4 pattern — keys and
 * paths differ, the map bridges them — rather than forcing identity keys.
 */

import type { FieldMap } from '../field-map';
import type { ExtractionSchema } from '../types';
import { registerExtractionSchema } from './_registry';

export const rentAgreementExtractionSchema: ExtractionSchema = {
  key: 'rent_agreement',
  name: 'Rent Agreement',
  version: '2026-06-09',
  documentTypeKey: 'rent_agreement',
  description:
    'A residential or commercial lease/rent agreement under Indian law.',
  fields: [
    { key: 'state', label: 'State (ISO 3166-2:IN)', type: 'string', format: 'IN-XX', description: 'e.g. IN-MH' },
    { key: 'city', label: 'City', type: 'string' },
    { key: 'execution_date', label: 'Date of execution', type: 'date', format: 'DD/MM/YYYY' },
    { key: 'registered', label: 'Is it registered?', type: 'boolean' },

    { key: 'landlord_name', label: 'Landlord — full name', type: 'string', required: true },
    { key: 'landlord_address', label: 'Landlord — address', type: 'string' },
    { key: 'tenant_name', label: 'Tenant — full name', type: 'string', required: true },
    { key: 'tenant_address', label: 'Tenant — address', type: 'string' },

    { key: 'property_address', label: 'Premises — address', type: 'string', required: true },
    { key: 'property_city', label: 'Premises — city', type: 'string' },
    { key: 'property_state', label: 'Premises — state', type: 'string' },
    { key: 'property_pincode', label: 'Premises — PIN code', type: 'string' },
    {
      key: 'property_type',
      label: 'Property type',
      type: 'enum',
      enumValues: ['apartment', 'independent_house', 'villa', 'commercial', 'pg_room'],
    },

    { key: 'start_date', label: 'Lease start date', type: 'date', format: 'DD/MM/YYYY', required: true },
    { key: 'duration_months', label: 'Duration (months)', type: 'number' },
    { key: 'rent_monthly', label: 'Monthly rent (₹)', type: 'currency', format: 'INR', required: true },
    { key: 'deposit_amount', label: 'Security deposit (₹)', type: 'currency', format: 'INR' },
    { key: 'rent_due_day', label: 'Rent due day of month', type: 'number' },
  ],
};

/** extractionKey → rentAgreementBundle dot-path (Zod shape in @org/document-schema). */
export const rentAgreementFieldMap: FieldMap = {
  schemaKey: 'rent_agreement',
  documentTypeKey: 'rent_agreement',
  version: '2026-06-09',
  mapping: {
    state: 'state',
    city: 'city',
    execution_date: 'executionDate',
    registered: 'registered',
    landlord_name: 'parties.landlord.name',
    landlord_address: 'parties.landlord.address',
    tenant_name: 'parties.tenant.name',
    tenant_address: 'parties.tenant.address',
    property_address: 'property.address',
    property_city: 'property.city',
    property_state: 'property.state',
    property_pincode: 'property.pincode',
    property_type: 'property.type',
    start_date: 'term.startDate',
    duration_months: 'term.durationMonths',
    rent_monthly: 'rent_deposit.rentMonthly',
    deposit_amount: 'rent_deposit.depositAmount',
    rent_due_day: 'rent_deposit.rentDueDay',
  },
};

registerExtractionSchema(rentAgreementExtractionSchema, rentAgreementFieldMap);
