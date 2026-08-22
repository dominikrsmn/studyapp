import { z } from 'zod';
import type { Prisma } from '../../infrastructure/database/generated/client';

export const factSchema = z.object({
  content: z.string(),
  chunkIds: z.array(z.string()).min(1),
});

export const topicCandidateSchema = z.object({
  title: z.string(),
  description: z.string(),
  facts: z.array(factSchema),
});

export const topicCandidatesSchema = z.object({
  candidates: z.array(topicCandidateSchema),
});

export const topicCandidateConsolidationGroupSchema = z.object({
  title: z.string(),
  description: z.string(),
  candidateIndexes: z.array(z.number().int().nonnegative()).min(1),
});

export const topicCandidateConsolidationSchema = z.object({
  groups: z.array(topicCandidateConsolidationGroupSchema),
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

export const topicMergingSchema = z.object({
  existingTopicMatches: z.array(existingTopicMatchSchema),
  newTopics: z.array(newTopicSchema),
});

export type TopicMerging = z.infer<typeof topicMergingSchema>;

export type TopicCandidateConsolidation = z.infer<
  typeof topicCandidateConsolidationSchema
>;

export type TopicCandidate = z.infer<typeof topicCandidateSchema>;

export type Fact = z.infer<typeof factSchema>;

export type AnalysisChunk = {
  id: string;
  content: string;
  sourceId: string;
  sourcePageId: string;
  pageNumber: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
};

export type EvidenceProvenance = Pick<
  AnalysisChunk,
  | 'sourceId'
  | 'sourcePageId'
  | 'pageNumber'
  | 'chunkIndex'
  | 'startOffset'
  | 'endOffset'
  | 'content'
> & {
  analysisChunkId: string;
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
        provenance: {
          select: {
            analysisChunkId: true;
          };
        };
      };
    };
  };
}>;
