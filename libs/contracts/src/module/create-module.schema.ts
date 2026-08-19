import { z } from 'zod';

export const createModuleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  icon: z.string().min(1),
  examDate: z.iso.date().optional(),
});

export type CreateModule = z.infer<typeof createModuleSchema>;
