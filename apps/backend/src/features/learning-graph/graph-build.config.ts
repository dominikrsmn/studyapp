import { registerAs } from '@nestjs/config';

export const graphBuildConfig = registerAs('graphBuild', () => ({
  flowProducer: { name: 'learning-graph-flow' },
  batching: { targetTopicCount: 30, minimumLastBatchSize: 10 },
  candidateCount: 30,
  queue: {
    name: 'learning-graph',
    concurrency: 1,
    jobs: {
      dispatch_candidate_batches: 'dispatch-candidate-batches',
      find_candidates: 'find-candidates',
      create_graph: 'create-graph',
      refine_graph: 'refine-graph',
      detect_cycles: 'detect-cycles',
    },
  },
}));
