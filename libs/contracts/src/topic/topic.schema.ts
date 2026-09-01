import { z } from 'zod';

export const sourceTopicOverviewSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  pageStart: z.number().int().positive().nullable(),
  pageEnd: z.number().int().positive().nullable(),
  source: z.object({
    id: z.uuid(),
    name: z.string(),
  }),
});

export const topicOverviewSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  summary: z.string().nullable(),
  sourceTopics: z.array(sourceTopicOverviewSchema),
});

export type SourceTopicOverviewDto = z.infer<typeof sourceTopicOverviewSchema>;
export type TopicOverviewDto = z.infer<typeof topicOverviewSchema>;
