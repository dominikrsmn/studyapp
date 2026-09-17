import { z } from 'zod';
import { processingStateSchema } from '../source/source.schema';

export const graphBuildStatusSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
  status: processingStateSchema,
  errorMessage: z.string().nullable(),
  current: z.boolean(),
});
export type GraphBuildStatusDto = z.infer<typeof graphBuildStatusSchema>;

export const publishedLearningGraphSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
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
