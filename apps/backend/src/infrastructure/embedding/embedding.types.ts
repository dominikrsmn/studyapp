import { GraphBuildJobData } from '../../features/learning-graph/graph-build.types';

export interface CreateTopicEmbeddingsJobData extends GraphBuildJobData {
  topicIds: string[];
}

export interface CreateEvidenceEmbeddingsJobData extends GraphBuildJobData {
  topicEvidenceIds: string[];
}

export type EmbeddingJobData =
  CreateTopicEmbeddingsJobData | CreateEvidenceEmbeddingsJobData;
