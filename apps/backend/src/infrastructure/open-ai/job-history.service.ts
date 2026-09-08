import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../database/prisma/prisma.service';
import { jobCostContext } from './job-cost-context';

@Injectable()
export class JobHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(job: Job, process: () => Promise<T>): Promise<T> {
    const sourceIds: string[] = job.data.sourceId
      ? [job.data.sourceId]
      : job.data.topicId
        ? (
            await this.prisma.sourceTopic.findMany({
              where: { topicId: job.data.topicId },
              select: { sourceId: true },
              distinct: ['sourceId'],
            })
          ).map(({ sourceId }) => sourceId)
        : [];
    const execution = await this.prisma.sourceJob.create({
      data: {
        sourceIds,
        name: job.name,
        queue: job.queueName,
        jobId: job.id ?? '',
        attempt: job.attemptsMade + 1,
        state: 'PROCESSING',
      },
    });
    return jobCostContext.run(execution.id, async () => {
      try {
        const result = await process();
        await this.prisma.sourceJob.update({
          where: { id: execution.id },
          data: { state: 'COMPLETED', finishedAt: new Date() },
        });
        return result;
      } catch (error) {
        await this.prisma.sourceJob.update({
          where: { id: execution.id },
          data: {
            state:
              error instanceof Error && error.name === 'WaitingChildrenError'
                ? 'WAITING'
                : 'FAILED',
            finishedAt: new Date(),
          },
        });
        throw error;
      }
    });
  }
}
