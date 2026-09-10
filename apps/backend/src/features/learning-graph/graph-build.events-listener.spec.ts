import type { Queue } from 'bullmq';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GraphBuildEventsListener } from './graph-build.events-listener';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('GraphBuildEventsListener', () => {
  const data = {
    graphId: 'graph-id',
    moduleId: 'module-id',
    graphVersion: 7,
  };
  const queue = { getJob: jest.fn() };
  const prisma = { learningGraph: { updateMany: jest.fn() } };
  const listener = new GraphBuildEventsListener(
    queue as unknown as Queue,
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    queue.getJob.mockResolvedValue({ data, isFailed: jest.fn(() => true) });
    prisma.learningGraph.updateMany.mockResolvedValue({ count: 1 });
  });

  it('ignores failure events for jobs that still have a retry remaining', async () => {
    queue.getJob.mockResolvedValueOnce({
      data,
      isFailed: jest.fn(() => false),
    });

    await listener.onFailed({
      jobId: 'retryable-job',
      failedReason: 'temporary failure',
    });

    expect(prisma.learningGraph.updateMany).not.toHaveBeenCalled();
  });

  it('persists failures propagated from child jobs', async () => {
    await listener.onFailed({
      jobId: 'dispatch-job',
      failedReason: 'child embedding-job failed',
    });

    expect(prisma.learningGraph.updateMany).toHaveBeenCalledWith({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: data.graphVersion,
        status: 'QUEUED',
      },
      data: {
        status: 'FAILED',
        finishedAt: expect.any(Date),
        errorMessage: 'Graph job failed: child embedding-job failed',
      },
    });
  });

  it('uses a queued-only update so late failure events cannot overwrite completion', async () => {
    prisma.learningGraph.updateMany.mockResolvedValueOnce({ count: 0 });

    await listener.onFailed({
      jobId: 'refine-job',
      failedReason: 'late failure',
    });

    expect(prisma.learningGraph.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'QUEUED' }),
      }),
    );
  });
});
