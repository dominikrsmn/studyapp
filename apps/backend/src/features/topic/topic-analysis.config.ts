import { registerAs } from '@nestjs/config';

export const topicAnalysisConfig = registerAs('topicAnalysis', () => ({
  extraction: {
    model: 'gpt-5.6-luna',
    batchSize: 15,
  },
  grouping: {
    model: 'gpt-5.6-luna',
  },
  merging: {
    model: 'gpt-5.6-sol',
  },
  summaryGeneration: {
    model: 'gpt-5.6-sol',
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
