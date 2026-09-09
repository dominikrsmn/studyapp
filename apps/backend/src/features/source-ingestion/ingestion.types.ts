export type IngestionJobData =
  | ParseDocumentJobData
  | BuildRagChunksJobData
  | CreateRagEmbeddingsJobData
  | FinalizeIngestionJobData;

export interface ParseDocumentJobData {
  sourceId: string;
}

export interface BuildRagChunksJobData {
  sourceId: string;
}

export interface CreateRagEmbeddingsJobData {
  sourceId: string;
  chunkIds: string[];
}

export interface FinalizeIngestionJobData {
  sourceId: string;
}
