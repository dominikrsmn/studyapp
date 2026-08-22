import { registerAs } from '@nestjs/config';

export const topicAnalysisConfig = registerAs('topicAnalysis', () => ({
  queueName: 'topic-analysis',
  jobName: 'analyze-topics',
  attempts: 5,
  backoffDelay: 1_000,
  chunkSize: 1_000,
  chunkOverlap: 200,
}));
