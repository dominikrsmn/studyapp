import { registerAs } from '@nestjs/config';

export const embeddingConfig = registerAs('embedding', () => ({
  model: 'text-embedding-3-small',
  dimensions: 1536,
  encodingFormat: 'float' as const,
  batchSize: 64,
  queue: {
    name: 'embedding',
    concurrency: 10,
    jobs: {
      create_rag_embeddings: 'create-rag-embeddings',
      create_topic_embeddings: 'create-topic-embeddings',
      create_evidence_embeddings: 'create-evidence-embeddings',
    },
  },
}));
