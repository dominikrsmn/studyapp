import { z } from 'zod';
import type { Prisma } from '../../infrastructure/database/generated/client';

export const factSchema = z.object({
  content: z.string(),
  chunkIds: z.array(z.string()),
});

export const topicCandidateSchema = z.object({
  title: z.string(),
  description: z.string(),
  facts: z.array(factSchema),
});

export const topicCandidatesSchema = z.object({
  candidates: z.array(topicCandidateSchema),
});
export const existingTopicMatchSchema = z.object({
  topicId: z.uuid(),
  candidateIndexes: z.array(z.number().int().nonnegative()).min(1),
});

export const newTopicSchema = z.object({
  title: z.string(),
  description: z.string(),
  candidateIndexes: z.array(z.number().int().nonnegative()).min(1),
});

export const topicReconciliationSchema = z.object({
  existingTopicMatches: z.array(existingTopicMatchSchema),
  newTopics: z.array(newTopicSchema),
});

export type TopicReconciliation = z.infer<typeof topicReconciliationSchema>;

export type TopicCandidate = z.infer<typeof topicCandidateSchema>;

export type Fact = z.infer<typeof factSchema>;

export type AnalysisChunk = {
  content: string;
  pageNumber: number;
};

export type ModuleTopic = Prisma.TopicGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    summary: true;
    evidence: {
      select: {
        id: true;
        content: true;
      };
    };
  };
}>;
