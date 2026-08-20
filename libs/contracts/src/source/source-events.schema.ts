import { z } from 'zod';

export const sourceStateSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'failed',
]);

export const sourceStateChangedEventSchema = z.object({
  sourceId: z.uuid(),
  processingState: sourceStateSchema,
});

export type SourceStateChangedEvent = z.infer<
  typeof sourceStateChangedEventSchema
>;
