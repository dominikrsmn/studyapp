import { z } from 'zod';
import { processingStateSchema } from '../source/source.schema';

export const graphBuildStatusSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: processingStateSchema,
  errorMessage: z.string().nullable(),
  current: z.boolean(),
  retryableStage: z.enum(['GROUPING', 'PUBLICATION']).nullable(),
});
export type GraphBuildStatusDto = z.infer<typeof graphBuildStatusSchema>;

export const publishedLearningGraphSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  units: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      summary: z.string(),
      topicIds: z.array(z.uuid()),
      entryTopicId: z.uuid(),
      exitTopicIds: z.array(z.uuid()),
    }),
  ),
  ordering: z.array(
    z.object({
      sourceUnitId: z.uuid(),
      destinationUnitId: z.uuid(),
    }),
  ),
  topics: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      description: z.string(),
      prerequisiteIds: z.array(z.uuid()),
    }),
  ),
});

export type PublishedLearningGraphDto = z.infer<
  typeof publishedLearningGraphSchema
>;
