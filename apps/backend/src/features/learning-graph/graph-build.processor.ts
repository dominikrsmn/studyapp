import { GroupTopicsJob } from './jobs/group-topics.job';
import { PublishGraphJob } from './jobs/publish-graph.job';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { graphBuildConfig } from './graph-build.config';
import {
  failQueuedGraphBuild,
  graphBuildErrorMessage,
} from './graph-build.outcome';
import type {
  GraphJobData,
  DispatchCandidatesJobData,
  GetPrerequisitesJobData,
  GetPrerequisitesJobResult,
  GraphProposal,
  RecoverGraphJobData,
  RefineGraphJobData,
  DetectCyclesJobData,
} from './graph-build.types';
import { DispatchCandidatesJob } from './jobs/dispatch-candidates.job';
import { GetPrerequisitesJob } from './jobs/get-prerequisites.job';
import { RefineGraphJob } from './jobs/refine-graph.job';
import { DetectCyclesJob } from './jobs/detect-cycles.job';
import { RecoverGraphJob } from './jobs/recover-graph.job';

@Processor(graphBuildConfig().queue.name, {
  concurrency: graphBuildConfig().queue.concurrency,
})
export class GraphBuildProcessor extends WorkerHost {
  private readonly logger = new Logger(GraphBuildProcessor.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly dispatchCandidatesJob: DispatchCandidatesJob,
    private readonly getPrerequisitesJob: GetPrerequisitesJob,
    private readonly refineGraphJob: RefineGraphJob,
    private readonly detectCyclesJob: DetectCyclesJob,
    private readonly groupTopicsJob: GroupTopicsJob,
    private readonly publishGraphJob: PublishGraphJob,
    private readonly recoverGraphJob: RecoverGraphJob,
  ) {
    super();
  }

  async process(
    job: Job<GraphJobData>,
  ): Promise<void | GetPrerequisitesJobResult | GraphProposal> {
    if (job.data.recoveryRequested) {
      const data = { ...job.data, recoveryRequested: false };
      await job.updateData(data);
      job.data = data;
    }
    const startedAt = performance.now();
    this.logger.log(
      `Processing ${job.name} job: ${job.id}, attempt ${job.attemptsMade + 1}`,
    );
    try {
      const result = await this.processJob(job);
      this.logger.log(
        `Completed ${job.name} job: ${job.id} in ${Math.round(performance.now() - startedAt)}ms`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Failed ${job.name} job: ${job.id} after ${Math.round(performance.now() - startedAt)}ms: ${graphBuildErrorMessage(error)}`,
      );
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
        try {
          await failQueuedGraphBuild(
            this.prismaService,
            job.data,
            `Graph job "${job.name}" failed: ${graphBuildErrorMessage(error)}`,
          );
        } catch (persistenceError) {
          this.logger.error(
            `Failed to persist processing failure for graph "${job.data.graphId}": ${graphBuildErrorMessage(persistenceError)}`,
            persistenceError instanceof Error
              ? persistenceError.stack
              : undefined,
          );
        }
      }
      throw error;
    }
  }

  private processJob(
    job: Job<GraphJobData>,
  ): Promise<void | GetPrerequisitesJobResult | GraphProposal> {
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
      case jobs.group_topics:
        return this.groupTopicsJob.process(job);
      case jobs.publish_graph:
        return this.publishGraphJob.process(job);
      case jobs.recover_graph:
        return this.recoverGraphJob.process(job as Job<RecoverGraphJobData>);
      case jobs.refine_graph:
        return this.refineGraphJob.process(job as Job<RefineGraphJobData>);
      case jobs.detect_cycles:
        return this.detectCyclesJob.process(job as Job<DetectCyclesJobData>);
      default:
        throw new Error('Unknown job name: ' + job.name);
    }
  }
}
