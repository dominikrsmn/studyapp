import { registerAs } from '@nestjs/config';

export const topicAnalysisConfig = registerAs('topicAnalysis', () => ({
  extraction: {
    model: 'gpt-5.6-luna',
    batchSize: 15,
  },
  consolidation: {
    model: 'gpt-5.6-luna',
  },
  chunks: {
    chunkSize: 5_000,
    chunkOverlap: 1_000,
  },
  queue: {
    queueName: 'topic-analysis',
    jobName: 'analyze-topics',
    attempts: 5,
    backoffDelay: 1_000,
  },
}));
