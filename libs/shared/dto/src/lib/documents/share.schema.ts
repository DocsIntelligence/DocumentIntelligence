import { z } from 'zod';

export const shareModeSchema = z.enum(['view', 'comment', 'edit']);
export type ShareModeValue = z.infer<typeof shareModeSchema>;

/**
 * The Share dialog's client-side form. `expiryDays` is a UI convenience that the
 * dialog maps to the server's `expiresAt` ISO timestamp. Password mirrors the
 * server's 4–64 char rule; an empty string means "no password".
 */
export const shareFormSchema = z.object({
  mode: shareModeSchema.default('view'),
  password: z
    .union([
      z.literal(''),
      z
        .string()
        .min(4, 'Use at least 4 characters')
        .max(64, 'Password is too long (max 64)'),
    ])
    .default(''),
  expiryDays: z.enum(['0', '7', '30']).default('0'),
});
export type ShareFormValues = z.infer<typeof shareFormSchema>;
