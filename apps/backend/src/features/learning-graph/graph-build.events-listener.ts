import {
  InjectQueue,
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { graphBuildConfig } from './graph-build.config';
import {
  failQueuedGraphBuild,
  graphBuildErrorMessage,
} from './graph-build.outcome';
import type { GraphBuildJobData } from './graph-build.types';

@QueueEventsListener(graphBuildConfig().queue.name)
export class GraphBuildEventsListener extends QueueEventsHost {
  private readonly logger = new Logger(GraphBuildEventsListener.name);

  constructor(
    @InjectQueue(graphBuildConfig().queue.name)
    private readonly graphBuildQueue: Queue<GraphBuildJobData>,
    private readonly prismaService: PrismaService,
  ) {
    super();
  }

  @OnQueueEvent('failed')
  async onFailed({
    jobId,
    failedReason,
  }: {
    jobId: string;
    failedReason: string;
  }): Promise<void> {
    const job = await this.graphBuildQueue.getJob(jobId);
    if (!job) return;
    if (!(await job.isFailed())) return;

    try {
      await this.prismaService.$transaction(async (transaction) => {
        const modules = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Module"
          WHERE "id" = ${job.data.moduleId}
            AND "graphVersion" = ${job.data.graphVersion}
          FOR UPDATE`;
        if (!modules.length) return;

        const currentJob = await this.graphBuildQueue.getJob(jobId);
        if (
          !currentJob ||
          !(await currentJob.isFailed()) ||
          currentJob.data.recoveryRequested
        ) {
          return;
        }
        await failQueuedGraphBuild(
          transaction,
          currentJob.data,
          `Graph job failed: ${failedReason}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist propagated failure for graph "${job.data.graphId}": ${graphBuildErrorMessage(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
