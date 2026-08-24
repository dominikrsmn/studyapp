import { z } from 'zod';

export const sourceStateSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
]);

export const sourceStateChangedEventSchema = z.object({
  sourceId: z.uuid(),
  moduleId: z.string(),
  processingState: sourceStateSchema,
  info: z.string().optional(),
});

export type SourceStateChangedEvent = z.infer<
  typeof sourceStateChangedEventSchema
>;
