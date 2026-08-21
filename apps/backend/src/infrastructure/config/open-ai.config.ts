import { registerAs } from '@nestjs/config';

export const openAiConfig = registerAs('openAi', () => ({
  apiKey: process.env['OPENAI_API_KEY'] as string,
}));
