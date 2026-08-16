import { z } from 'zod';

export const uploadSourceSchema = z.object({
  moduleId: z.uuid(),
});

export type UploadSource = z.infer<typeof uploadSourceSchema>;
