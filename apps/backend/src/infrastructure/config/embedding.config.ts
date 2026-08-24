import { registerAs } from '@nestjs/config';

export const embeddingConfig = registerAs('embedding', () => ({
  model: 'text-embedding-3-small',
  encodingFormat: 'float' as const,
  batchSize: 64,
}));
