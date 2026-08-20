import { z } from 'zod';

export const sourceStateSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
]);

export const sourceStateChangedEventSchema = z.object({
  sourceId: z.uuid(),
  moduleId: z.string(),
  processingState: sourceStateSchema,
});

export type SourceStateChangedEvent = z.infer<
  typeof sourceStateChangedEventSchema
>;
