import { registerAs } from '@nestjs/config';

export const analysisConfig = registerAs('topicAnalysis', () => ({
  flowProducer: { name: 'topic-analysis-flow' },
  boundaryDetection: {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'medium' as const,
    windowSize: 70,
    windowOverlap: 20,
  },
  boundaryMerging: {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'medium' as const,
    contextRadius: 4,
    shortSpanReviewThreshold: 8,
  },
  sourceTopicExtraction: {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'medium' as const,
  },
  queue: {
    name: 'topic-analysis',
    jobs: {
      prepare_topic_analysis: 'prepare-topic-analysis',
      detect_boundaries: 'detect-boundaries',
      merge_boundaries: 'merge-boundaries',
      extract_source_topics: 'extract-source-topics',
      match_source_topics: 'match-source-topics',
      finalize_topic_analysis: 'finalize-topic-analysis',
    },
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
