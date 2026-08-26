export type IngestionJobData =
  | ParseDocumentJobData
  | BuildRagChunksJobData
  | EmbedRagChunksJobData
  | FinalizeIngestionJobData;

export interface ParseDocumentJobData {
  sourceId: string;
}

export interface BuildRagChunksJobData {
  sourceId: string;
}

export interface EmbedRagChunksJobData {
  sourceId: string;
  chunkIds: string[];
}

export interface FinalizeIngestionJobData {
  sourceId: string;
}
