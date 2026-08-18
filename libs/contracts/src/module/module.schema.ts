import { z } from 'zod';

export const moduleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  icon: z.string(),
  description: z.string().nullable(),
});

export type ModuleDto = z.infer<typeof moduleSchema>;
