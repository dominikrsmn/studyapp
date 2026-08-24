import { registerAs } from '@nestjs/config';

export const ingestionConfig = registerAs('ingestion', () => ({
  upload: { maxBytes: 10_000_000 },
  document: { maxPages: 300, maxTextCharacters: 2_000_000 },
  chunking: { size: 1_000, overlap: 200 },
  queue: {
    name: 'source-ingestion',
    jobName: 'ingest-source',
    concurrency: 3,
    attempts: 5,
    backoffDelay: 1_000,
  },
}));
