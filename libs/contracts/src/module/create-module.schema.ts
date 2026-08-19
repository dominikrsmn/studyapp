import { z } from 'zod';
import { dateOnlySchema } from '../util/date-only';

export const createModuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().min(1),
  examDate: dateOnlySchema.optional(),
});

export type CreateModule = z.infer<typeof createModuleSchema>;
