import type { Job } from 'bullmq';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { GraphProposal, RefineGraphJobData } from '../graph-build.types';
import { RefineGraphJob } from './refine-graph.job';

jest.mock('../../../infrastructure/database/generated/client', () => ({
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    }),
  },
}));
jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('RefineGraphJob', () => {
  const data: RefineGraphJobData = {
    graphId: 'graph-id',
    moduleId: 'module-id',
    graphVersion: 7,
  };
  const proposal: GraphProposal = {
    topicIds: ['topic-a', 'topic-b', 'topic-c'],
    dependencies: [
      { topicId: 'topic-a', dependsOnTopicId: 'topic-b' },
      { topicId: 'topic-a', dependsOnTopicId: 'topic-c' },
      { topicId: 'topic-b', dependsOnTopicId: 'topic-c' },
    ],
  };
  const transaction = {
    $queryRaw: jest.fn(),
    learningGraph: { findUnique: jest.fn(), update: jest.fn() },
    topic: { findMany: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const job = {
    data,
    getChildrenValues: jest.fn(),
  } as unknown as Job<RefineGraphJobData>;
  const refineGraphJob = new RefineGraphJob(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    transaction.$queryRaw.mockResolvedValue([{ id: data.moduleId }]);
    transaction.learningGraph.findUnique.mockResolvedValue({
      id: data.graphId,
    });
    transaction.topic.findMany.mockResolvedValue(
      proposal.topicIds.map((id) => ({ id })),
    );
    transaction.topic.update.mockResolvedValue({});
    transaction.learningGraph.update.mockResolvedValue({});
    job.getChildrenValues = jest
      .fn()
      .mockResolvedValue({ 'detect-cycles': proposal });
  });

  it('publishes a current proposal and completes its eligible graph build', async () => {
    await refineGraphJob.process(job);

    const query = transaction.$queryRaw.mock.calls[0][0];
    expect(query.strings.join('?')).toContain('FOR UPDATE');
    expect(query.values).toEqual([data.moduleId, data.graphVersion]);
    expect(transaction.learningGraph.findUnique).toHaveBeenCalledWith({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: data.graphVersion,
        status: 'QUEUED',
      },
      select: { id: true },
    });
    expect(transaction.topic.update.mock.calls).toEqual([
      [
        {
          where: { id: 'topic-a' },
          data: { prerequisites: { set: [{ id: 'topic-b' }] } },
        },
      ],
      [
        {
          where: { id: 'topic-b' },
          data: { prerequisites: { set: [{ id: 'topic-c' }] } },
        },
      ],
      [
        {
          where: { id: 'topic-c' },
          data: { prerequisites: { set: [] } },
        },
      ],
    ]);
    expect(transaction.learningGraph.update).toHaveBeenCalledWith({
      where: {
        id: data.graphId,
        moduleId: data.moduleId,
        version: data.graphVersion,
        status: 'QUEUED',
      },
      data: {
        status: 'COMPLETED',
        finishedAt: expect.any(Date),
        errorMessage: null,
      },
    });
  });

  it('does not publish or complete after the module version changes', async () => {
    transaction.$queryRaw.mockResolvedValue([]);

    await refineGraphJob.process(job);

    expect(transaction.learningGraph.findUnique).not.toHaveBeenCalled();
    expect(transaction.topic.update).not.toHaveBeenCalled();
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });

  it('does not publish when the graph build is no longer eligible', async () => {
    transaction.learningGraph.findUnique.mockResolvedValue(null);

    await refineGraphJob.process(job);

    expect(transaction.topic.update).not.toHaveBeenCalled();
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });

  it('does not clear prerequisites for a module topic absent from the proposal', async () => {
    transaction.topic.findMany.mockResolvedValue([
      ...proposal.topicIds.map((id) => ({ id })),
      { id: 'topic-outside-proposal' },
    ]);

    await refineGraphJob.process(job);

    expect(transaction.topic.findMany).not.toHaveBeenCalled();
    expect(transaction.topic.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'topic-outside-proposal' } }),
    );
  });

  it('does not complete the build when prerequisite replacement fails', async () => {
    transaction.topic.update.mockRejectedValueOnce(
      new Error('Prerequisite write failed'),
    );

    await expect(refineGraphJob.process(job)).rejects.toThrow(
      'Prerequisite write failed',
    );
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });
});
