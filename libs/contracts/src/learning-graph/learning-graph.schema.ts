import { z } from 'zod';

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
