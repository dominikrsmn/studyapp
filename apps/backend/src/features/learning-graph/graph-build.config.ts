import { registerAs } from '@nestjs/config';

export const graphBuildConfig = registerAs('graphBuild', () => ({
  flowProducer: { name: 'learning-graph-flow' },
  candidateCount: 30,
  prerequisiteSelection: {
    model: 'gpt-5.6-luna',
    reasoningEffort: 'medium' as const,
  },
  queue: {
    name: 'learning-graph',
    concurrency: 1,
    jobs: {
      dispatch_candidates: 'dispatch-candidates',
      get_prerequisites: 'get-prerequisites',
      refine_graph: 'refine-graph',
      detect_cycles: 'detect-cycles',
    },
  },
}));
