import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { GraphBuildQueue } from '../graph-build.queue';
import { DispatchCandidatesJob } from './dispatch-candidates.job';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../infrastructure/database/generated/client', () => ({
  Prisma: { sql: (strings: TemplateStringsArray) => strings.join('?') },
}));
jest.mock('../graph-build.queue', () => ({
  GraphBuildQueue: class GraphBuildQueue {},
}));

describe('DispatchCandidatesJob', () => {
  const data = {
    graphId: 'graph-id',
    moduleId: 'module-id',
    graphVersion: 7,
  };
  const transaction = {
    learningGraph: { findUnique: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const prisma = {
    $transaction: jest.fn(),
    learningGraph: { updateMany: jest.fn() },
  };
  const queue = { addGraphFlow: jest.fn() };
  const job = new DispatchCandidatesJob(
    prisma as unknown as PrismaService,
    queue as unknown as GraphBuildQueue,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    prisma.learningGraph.updateMany.mockResolvedValue({ count: 1 });
  });

  it('fails a queued build when stale work exits cleanly', async () => {
    transaction.learningGraph.findUnique.mockResolvedValue(null);

    await job.process(data);

    expect(queue.addGraphFlow).not.toHaveBeenCalled();
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
        errorMessage: 'Graph build became stale before candidate dispatch',
      },
    });
  });
});
