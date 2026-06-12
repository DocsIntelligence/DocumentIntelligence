import { z } from 'zod';

/**
 * Payslip / Salary slip — monthly pay statement. India statutory components
 * (Basic, HRA, PF, ESI, PT, TDS) and a generic global mode both fit the
 * flexible earnings/deductions arrays. Net pay is computed from the components
 * (gross earnings − total deductions) so it can never drift.
 * Sections: payslip / employer / employee / earnings / deductions / notes.
 */

const CURRENCY = z
  .enum(['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD'])
  .default('INR');

export const PayComponentSchema = z.object({
  component: z.string().min(1).max(80),
  amount: z.coerce.number().min(0).default(0),
});

export const PayslipMetaSchema = z.object({
  /** Human label for the pay period, e.g. "June 2026". */
  payPeriodLabel: z.string().min(1).max(40),
  payDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
  currency: CURRENCY,
  paidDays: z.coerce.number().min(0).max(31).optional(),
  lopDays: z.coerce.number().min(0).max(31).optional(),
});

export const PayslipEmployerSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  gstinPan: z.string().max(20).optional(),
});

export const PayslipEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(40).optional(),
  designation: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  pan: z.string().max(12).optional(),
  uan: z.string().max(24).optional(),
  esiNumber: z.string().max(24).optional(),
  bankName: z.string().max(160).optional(),
  bankAccount: z.string().max(40).optional(),
  dateOfJoining: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
    .optional(),
});

export const PayslipNotesSchema = z.object({
  note: z.string().max(1000).optional(),
});

export const PayslipSchema = z.object({
  payslip: PayslipMetaSchema,
  employer: PayslipEmployerSchema,
  employee: PayslipEmployeeSchema,
  earnings: z.array(PayComponentSchema).min(1),
  deductions: z.array(PayComponentSchema),
  notes: PayslipNotesSchema,
});

export type PayslipData = z.infer<typeof PayslipSchema>;
export type PayComponent = z.infer<typeof PayComponentSchema>;

/** Loose variant for autosave of half-filled drafts. */
export const PayslipDraftSchema = PayslipSchema.partial();
