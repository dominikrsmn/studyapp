import { z } from 'zod';

export const sourceStatusSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
]);

export const sourceTypeSchema = z.enum([
  'DOCUMENT',
  'IMAGE',
  'AUDIO',
  'TEXT',
  'WEB',
]);

export const sourceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: sourceTypeSchema,
  mimeType: z.string(),
  status: sourceStatusSchema,
  moduleId: z.uuid(),
});

export type SourceDto = z.infer<typeof sourceSchema>;
