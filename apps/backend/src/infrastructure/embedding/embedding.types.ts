import { GraphBuildJobData } from '../../features/learning-graph/graph-build.types';

export interface CreateTopicEmbeddingsJobData extends GraphBuildJobData {
  topicIds: string[];
}

export interface CreateEvidenceEmbeddingsJobData extends GraphBuildJobData {
  topicEvidenceIds: string[];
}

export interface CreateRagEmbeddingsJobData {
  sourceId: string;
  chunkIds: string[];
}

export type EmbeddingJobData =
  | CreateTopicEmbeddingsJobData
  | CreateEvidenceEmbeddingsJobData
  | CreateRagEmbeddingsJobData;
