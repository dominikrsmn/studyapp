export type IngestionJobData =
  | ParseDocumentJobData
  | BuildRagChunksJobData
  | FinalizeIngestionJobData;

export interface ParseDocumentJobData {
  sourceId: string;
}

export interface BuildRagChunksJobData {
  sourceId: string;
}

export interface FinalizeIngestionJobData {
  sourceId: string;
}
