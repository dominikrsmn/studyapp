import { registerAs } from '@nestjs/config';

export const analysisConfig = registerAs('topicAnalysis', () => ({
  queue: {
    name: 'topic-analysis',
    jobs: [
      'prepare-topic-analysis',
      'detect-boundaries',
      'merge-boundaries',
      'extract-source-topics',
      'match-source-topics',
      'finalize-topic-analysis',
    ],
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
