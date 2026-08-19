import { z } from 'zod';
import { dateOnlySchema } from '../util/date-only';

export const moduleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string(),
  description: z.string().nullable(),
  examDate: dateOnlySchema.optional(),
});

export type ModuleDto = z.infer<typeof moduleSchema>;
