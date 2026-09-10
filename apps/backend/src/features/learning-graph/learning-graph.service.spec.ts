import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { GraphBuildQueue } from './graph-build.queue';
import { LearningGraphService } from './learning-graph.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('./graph-build.queue', () => ({
  GraphBuildQueue: class GraphBuildQueue {},
}));

describe('LearningGraphService', () => {
  const transaction = {
    $queryRaw: jest.fn(),
    module: { update: jest.fn() },
    learningGraph: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
    learningGraph: { updateMany: jest.fn() },
  };
  const queue = { addEmbeddingFlow: jest.fn() };
  const service = new LearningGraphService(
    prisma as unknown as PrismaService,
    queue as unknown as GraphBuildQueue,
  );
  const data = { graphId: 'graph-id', moduleId: 'module-id', graphVersion: 7 };
  let committed = false;

  beforeEach(() => {
    jest.resetAllMocks();
    committed = false;
    prisma.$transaction.mockImplementation(async (operation) => {
      const result = await operation(transaction);
      committed = true;
      return result;
    });
    transaction.$queryRaw.mockResolvedValue([{ id: data.moduleId }]);
    transaction.learningGraph.findFirst.mockResolvedValue(null);
    transaction.learningGraph.create.mockResolvedValue({
      id: data.graphId,
      status: 'QUEUED',
    });
    transaction.learningGraph.updateMany.mockResolvedValue({ count: 0 });
    prisma.learningGraph.updateMany.mockResolvedValue({ count: 1 });
    queue.addEmbeddingFlow.mockImplementation(async () => {
      expect(committed).toBe(true);
    });
  });

  it('queues the caller version after commit without incrementing it', async () => {
    await expect(service.regenerate(data.moduleId, 7)).resolves.toEqual(data);
    const [sql, moduleId, version] = transaction.$queryRaw.mock.calls[0];
    expect(sql.join('?')).toContain('"graphVersion" = ?');
    expect(sql.join('?')).toContain('FOR UPDATE');
    expect([moduleId, version]).toEqual([data.moduleId, 7]);
    expect(transaction.module.update).not.toHaveBeenCalled();
    expect(transaction.learningGraph.create).toHaveBeenCalledWith({
      data: { moduleId: data.moduleId, version: 7, status: 'QUEUED' },
      select: { id: true, status: true },
    });
    expect(transaction.learningGraph.updateMany).toHaveBeenCalledWith({
      where: {
        moduleId: data.moduleId,
        version: { lt: 7 },
        status: 'QUEUED',
      },
      data: {
        status: 'FAILED',
        finishedAt: expect.any(Date),
        errorMessage: 'Superseded by graph version 7',
      },
    });
    expect(queue.addEmbeddingFlow).toHaveBeenCalledWith(data);
  });

  it('skips an obsolete version before creating or queueing work', async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(service.regenerate(data.moduleId, 6)).resolves.toBeNull();
    expect(transaction.learningGraph.findFirst).not.toHaveBeenCalled();
    expect(transaction.learningGraph.create).not.toHaveBeenCalled();
    expect(queue.addEmbeddingFlow).not.toHaveBeenCalled();
  });

  it('reuses the graph and queue identity for repeated requests', async () => {
    await service.regenerate(data.moduleId, 7);
    transaction.learningGraph.findFirst.mockResolvedValue({
      id: data.graphId,
      status: 'QUEUED',
    });
    await expect(service.regenerate(data.moduleId, 7)).resolves.toEqual(data);
    expect(transaction.learningGraph.create).toHaveBeenCalledTimes(1);
    expect(queue.addEmbeddingFlow.mock.calls).toEqual([[data], [data]]);
  });

  it.each(['PROCESSING', 'COMPLETED', 'FAILED'])(
    'does not restart an existing %s graph',
    async (status) => {
      transaction.learningGraph.findFirst.mockResolvedValue({
        id: data.graphId,
        status,
      });
      await expect(service.regenerate(data.moduleId, 7)).resolves.toEqual(data);
      expect(transaction.learningGraph.create).not.toHaveBeenCalled();
      expect(queue.addEmbeddingFlow).not.toHaveBeenCalled();
    },
  );

  it('marks a queued build failed when initial enqueueing fails', async () => {
    const enqueueError = new Error('Queue unavailable');
    queue.addEmbeddingFlow.mockRejectedValueOnce(enqueueError);

    await expect(service.regenerate(data.moduleId, 7)).rejects.toThrow(
      'Queue unavailable',
    );
    expect(prisma.learningGraph.updateMany).toHaveBeenCalledWith({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: 7,
        status: 'QUEUED',
      },
      data: {
        status: 'FAILED',
        finishedAt: expect.any(Date),
        errorMessage: 'Failed to enqueue graph build: Queue unavailable',
      },
    });
  });

  it('rethrows the enqueue error when persisting its failure also fails', async () => {
    const enqueueError = new Error('Queue unavailable');
    queue.addEmbeddingFlow.mockRejectedValueOnce(enqueueError);
    prisma.learningGraph.updateMany.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );

    await expect(service.regenerate(data.moduleId, 7)).rejects.toBe(
      enqueueError,
    );
  });

  it('does not enqueue when graph creation fails to commit', async () => {
    prisma.$transaction.mockImplementationOnce(async (operation) => {
      await operation(transaction);
      throw new Error('Commit failed');
    });
    await expect(service.regenerate(data.moduleId, 7)).rejects.toThrow(
      'Commit failed',
    );
    expect(queue.addEmbeddingFlow).not.toHaveBeenCalled();
  });
});
