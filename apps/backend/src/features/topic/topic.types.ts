import { z } from 'zod';
import { Prisma } from '../../infrastructure/database/generated/client';

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

export const generatedTopicSchema = z.object({
  id: z.uuid().optional(),
  title: z.string(),
  description: z.string(),
  state: z.string(),
  summary: z.string().optional(),
  evidence: z.array(factSchema),
});

export const generatedTopicsSchema = z.object({
  topics: z.array(generatedTopicSchema),
});

export type GeneratedTopic = z.infer<typeof generatedTopicSchema>;

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
