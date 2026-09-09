import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { graphBuildConfig } from './graph-build.config';
import type {
  GraphJobData,
  DispatchCandidatesJobData,
  FindCandidatesJobData,
  CreateGraphJobData,
  RefineGraphJobData,
  DetectCyclesJobData,
} from './graph-build.types';
import { DispatchCandidatesJob } from './jobs/dispatch-candidates.job';
import { FindCandidatesJob } from './jobs/find-candidates.job';
import { CreateGraphJob } from './jobs/create-graph.job';
import { RefineGraphJob } from './jobs/refine-graph.job';
import { DetectCyclesJob } from './jobs/detect-cycles.job';

@Processor(graphBuildConfig().queue.name, {
  concurrency: graphBuildConfig().queue.concurrency,
})
export class GraphBuildProcessor extends WorkerHost {
  constructor(
    private readonly dispatchCandidatesJob: DispatchCandidatesJob,
    private readonly findCandidatesJob: FindCandidatesJob,
    private readonly createGraphJob: CreateGraphJob,
    private readonly refineGraphJob: RefineGraphJob,
    private readonly detectCyclesJob: DetectCyclesJob,
  ) {
    super();
  }

  process(job: Job<GraphJobData>): Promise<void> {
    const { jobs } = graphBuildConfig().queue;
    switch (job.name) {
      case jobs.dispatch_candidates:
        return this.dispatchCandidatesJob.process(
          job.data as DispatchCandidatesJobData,
        );
      case jobs.find_candidates:
        return this.findCandidatesJob.process(
          job.data as FindCandidatesJobData,
        );
      case jobs.create_graph:
        return this.createGraphJob.process(job.data as CreateGraphJobData);
      case jobs.refine_graph:
        return this.refineGraphJob.process(job.data as RefineGraphJobData);
      case jobs.detect_cycles:
        return this.detectCyclesJob.process(job.data as DetectCyclesJobData);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
