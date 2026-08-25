import { z } from 'zod';
import {
  processingStateSchema,
  sourceProcessingStageTypeSchema,
} from './source.schema';

export const sourceStateChangedEventSchema = z.object({
  sourceId: z.uuid(),
  moduleId: z.string(),
  processingStage: sourceProcessingStageTypeSchema,
  processingState: processingStateSchema,
  info: z.string().optional(),
});

export type SourceStateChangedEvent = z.infer<
  typeof sourceStateChangedEventSchema
>;
