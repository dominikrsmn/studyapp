import { z } from 'zod';

export const sourceProcessingStageTypeSchema = z.enum([
  'CONVERSION',
  'RAG_INDEXING',
  'TOPIC_ANALYSIS',
]);

export const processingStateSchema = z.enum([
  'NOT_STARTED',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export const sourceProcessingStageSchema = z.object({
  stage: sourceProcessingStageTypeSchema,
  state: processingStateSchema,
  errorMessage: z.string().nullable(),
});

export const sourceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mimeType: z.string(),
  moduleId: z.uuid(),
  processingStages: z.array(sourceProcessingStageSchema),
});

export type ProcessingState = z.infer<typeof processingStateSchema>;
export type SourceProcessingStageType = z.infer<
  typeof sourceProcessingStageTypeSchema
>;
export type SourceProcessingStageDto = z.infer<
  typeof sourceProcessingStageSchema
>;
export type SourceDto = z.infer<typeof sourceSchema>;
