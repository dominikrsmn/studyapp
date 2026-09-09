import { registerAs } from '@nestjs/config';

export const graphBuildConfig = registerAs('graphBuild', () => ({
  flowProducer: { name: 'learning-graph-flow' },
  candidateCount: 30,
  queue: {
    name: 'learning-graph',
    concurrency: 1,
    jobs: {
      dispatch_candidates: 'dispatch-candidates',
      find_candidates: 'find-candidates',
      create_graph: 'create-graph',
      refine_graph: 'refine-graph',
      detect_cycles: 'detect-cycles',
    },
  },
}));
