import { registerAs } from '@nestjs/config';

export const graphBuildConfig = registerAs('graphBuild', () => ({
  flowProducer: { name: 'learning-graph-flow' },
  candidateCount: 30,
  prerequisiteSelection: {
    model: 'gpt-5.6-luna',
    reasoningEffort: 'medium' as const,
  },
  cycleResolution: {
    model: 'gpt-5.6-luna',
    reasoningEffort: 'medium' as const,
  },
  grouping: {
    model: 'gpt-5.6-luna',
    reasoningEffort: 'medium' as const,
    targetMinTopics: 5,
    targetMaxTopics: 10,
    minimumContributingTopics: 2,
    minimumDestinationCoverage: 0.3,
  },
  queue: {
    name: 'learning-graph',
    concurrency: 1,
    jobs: {
      dispatch_candidates: 'dispatch-candidates',
      get_prerequisites: 'get-prerequisites',
      refine_graph: 'refine-graph',
      group_topics: 'group-topics',
      publish_graph: 'publish-graph',
      recover_graph: 'recover-graph',
      detect_cycles: 'detect-cycles',
    },
  },
}));
