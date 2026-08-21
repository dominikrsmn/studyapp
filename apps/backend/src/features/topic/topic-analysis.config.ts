import { registerAs } from '@nestjs/config';

export const topicAnalysisConfig = registerAs('topicAnalysis', () => ({
  queueName: 'topic-analysis',
  jobName: 'analyze-topics',
  concurrency: 3,
  attempts: 5,
  backoffDelay: 1_000,
}));
