import { registerAs } from '@nestjs/config';

export const aiConfig = registerAs('ai', () => ({
  answerModel: 'gpt-5.6-sol',
  reasoningEffort: 'medium' as const,
  semanticSearchResultLimit: 5,
}));
