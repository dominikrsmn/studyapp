import z from 'zod';

export const createSourceSchema = z.object({
  moduleId: z.uuid(),
  file: z.file(),
});

export type CreateSource = z.infer<typeof createSourceSchema>;
