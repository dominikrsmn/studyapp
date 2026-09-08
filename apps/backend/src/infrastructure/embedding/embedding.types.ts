export interface EmbeddingBuildJobData {
  buildId: string;
  moduleId: string;
  expectedModuleRevision: number;
}

export interface CreateTopicEmbeddingsJobData extends EmbeddingBuildJobData {
  topicIds: string[];
}

export interface CreateEvidenceEmbeddingsJobData extends EmbeddingBuildJobData {
  topicEvidenceIds: string[];
}

export type EmbeddingJobData =
  CreateTopicEmbeddingsJobData | CreateEvidenceEmbeddingsJobData;
