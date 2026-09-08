import { registerAs } from '@nestjs/config';

export const ingestionConfig = registerAs('ingestion', () => ({
  upload: { maxBytes: 10_000_000 },
  document: { maxPages: 300, maxTextCharacters: 2_000_000 },
  flowProducer: { name: 'source-ingestion-flow' },
  rag: {
    chunking: {
      maxTokens: 512,
      tokenizer: 'sentence-transformers/all-MiniLM-L6-v2',
      mergePeers: true,
      useMarkdownTables: true,
    },
  },
  queue: {
    name: 'source-ingestion',
    jobs: {
      parse_document: 'parse-document',
      build_rag_chunks: 'build-rag-chunks',
      embed_rag_chunks: 'embed-rag-chunks',
      finalize_ingestion: 'finalize-ingestion',
    },
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential' as const,
        delay: 5_000,
      },
      removeOnComplete: {
        age: 60 * 60,
        count: 1_000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 5_000,
      },
    },
  },
}));
