import { registerAs } from '@nestjs/config';

export const retrievalConfig = registerAs('retrieval', () => ({
  semanticSearchResultLimit: 5,
}));
