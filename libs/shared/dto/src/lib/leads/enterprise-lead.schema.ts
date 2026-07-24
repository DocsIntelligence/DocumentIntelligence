import { z } from 'zod';

export const enterpriseLeadSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  company: z.string().min(2).max(150),
  teamSize: z
    .enum(['1-10', '11-50', '51-200', '201-1000', '1000+'])
    .optional(),
  message: z.string().max(2000).optional(),
});

export type EnterpriseLeadDto = z.infer<typeof enterpriseLeadSchema>;
