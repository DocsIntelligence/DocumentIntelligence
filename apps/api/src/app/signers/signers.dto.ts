import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const SIGNER_ROLES = [
  'party_a',
  'party_b',
  'witness',
  'lawyer',
  'custom',
] as const;

const AddSignerSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320).optional(),
  role: z.enum(SIGNER_ROLES).default('party_a'),
  /** Signing order; lower signs first. Defaults to append-at-end server-side. */
  order: z.number().int().min(0).max(999).optional(),
});
export class AddSignerDto extends createZodDto(AddSignerSchema) {}

const UpdateSignerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).nullish(),
  role: z.enum(SIGNER_ROLES).optional(),
  order: z.number().int().min(0).max(999).optional(),
});
export class UpdateSignerDto extends createZodDto(UpdateSignerSchema) {}

/**
 * Record a drawn or typed signature for a signer. `image` is a PNG data URL
 * for drawn signatures; `typedText` + `font` describe a typed signature.
 * (Remote/provider eSign — Aadhaar/DSC — is a separate flow.)
 */
const RecordSignatureSchema = z
  .object({
    method: z.enum(['draw', 'typed']),
    /** data:image/png;base64,… for method 'draw'. */
    image: z
      .string()
      .startsWith('data:image/')
      .max(2_000_000)
      .optional(),
    /** The typed name for method 'typed'. */
    typedText: z.string().min(1).max(200).optional(),
    /** Optional font-family label used to render the typed signature. */
    font: z.string().max(120).optional(),
  })
  .refine((v) => (v.method === 'draw' ? !!v.image : !!v.typedText), {
    message: 'draw signatures require an image; typed signatures require typedText',
  });
export class RecordSignatureDto extends createZodDto(RecordSignatureSchema) {}
