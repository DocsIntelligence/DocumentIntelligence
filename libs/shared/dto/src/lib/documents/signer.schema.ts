import { z } from 'zod';

export const SIGNER_ROLES = [
  'party_a',
  'party_b',
  'witness',
  'lawyer',
  'custom',
] as const;
export const signerRoleSchema = z.enum(SIGNER_ROLES);
export type SignerRoleValue = z.infer<typeof signerRoleSchema>;

/**
 * The "add signer" form. Email is optional but, when present, must be valid —
 * an empty string is allowed (the dialog maps it to `undefined` on submit, which
 * the server's stricter `.email().optional()` accepts).
 */
export const addSignerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(200, 'Name is too long'),
  email: z
    .union([
      z.literal(''),
      z.string().trim().email('Enter a valid email').max(320),
    ])
    .default(''),
  role: signerRoleSchema.default('party_a'),
});
export type AddSignerFormValues = z.infer<typeof addSignerFormSchema>;
