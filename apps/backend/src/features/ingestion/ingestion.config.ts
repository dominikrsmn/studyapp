import { registerAs } from '@nestjs/config';

export const ingestionConfig = registerAs('ingestion', () => ({
  maxUploadBytes: 10_000_000,
  maxPages: 300,
  maxTextCharacters: 2_000_000,
  batchSize: 64,
  chunkSize: 1_000,
  chunkOverlap: 200,
  embeddingModel: 'text-embedding-3-small',
  embeddingEncodingFormat: 'float' as const,
}));
