import { z } from 'zod';
import { sourceProcessingStageSchema } from './source.schema';

export const sourceJobsSchema = z.object({
  jobs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      attempt: z.number(),
      state: z.string(),
      startedAt: z.string(),
      finishedAt: z.string().nullable(),
      costUsd: z.string().nullable(),
      shared: z.boolean(),
    }),
  ),
  recordedCostUsd: z.string().nullable(),
  processingStages: z.array(sourceProcessingStageSchema),
});
export type SourceJobsDto = z.infer<typeof sourceJobsSchema>;
