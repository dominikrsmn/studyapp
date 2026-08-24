export const INGESTION_JOB = {
  PARSE_DOCUMENT: 'parse-document',
  BUILD_RAG_CHUNKS: 'build-rag-chunks',
  EMBED_RAG_CHUNKS: 'embed-rag-chunks',
  FINALIZE_INGESTION: 'finalize-ingestion',
} as const;

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
