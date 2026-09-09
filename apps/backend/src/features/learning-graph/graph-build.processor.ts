import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { graphBuildConfig } from './graph-build.config';
import type {
  GraphJobData,
  DispatchCandidatesJobData,
  GetPrerequisitesJobData,
  GetPrerequisitesJobResult,
  RefineGraphJobData,
  DetectCyclesJobData,
} from './graph-build.types';
import { DispatchCandidatesJob } from './jobs/dispatch-candidates.job';
import { GetPrerequisitesJob } from './jobs/get-prerequisites.job';
import { RefineGraphJob } from './jobs/refine-graph.job';
import { DetectCyclesJob } from './jobs/detect-cycles.job';

@Processor(graphBuildConfig().queue.name, {
  concurrency: graphBuildConfig().queue.concurrency,
})
export class GraphBuildProcessor extends WorkerHost {
  constructor(
    private readonly dispatchCandidatesJob: DispatchCandidatesJob,
    private readonly getPrerequisitesJob: GetPrerequisitesJob,
    private readonly refineGraphJob: RefineGraphJob,
    private readonly detectCyclesJob: DetectCyclesJob,
  ) {
    super();
  }

  process(job: Job<GraphJobData>): Promise<void | GetPrerequisitesJobResult> {
    const { jobs } = graphBuildConfig().queue;
    switch (job.name) {
      case jobs.dispatch_candidates:
        return this.dispatchCandidatesJob.process(
          job.data as DispatchCandidatesJobData,
        );
      case jobs.get_prerequisites:
        return this.getPrerequisitesJob.process(
          job.data as GetPrerequisitesJobData,
        );
      case jobs.refine_graph:
        return this.refineGraphJob.process(job.data as RefineGraphJobData);
      case jobs.detect_cycles:
        return this.detectCyclesJob.process(job.data as DetectCyclesJobData);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
