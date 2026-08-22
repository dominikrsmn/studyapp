import { z } from 'zod';

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

export type TopicCandidate = z.infer<typeof topicCandidateSchema>;

export type Fact = z.infer<typeof factSchema>;

export type AnalysisChunk = {
  content: string;
  pageNumber: number;
};
