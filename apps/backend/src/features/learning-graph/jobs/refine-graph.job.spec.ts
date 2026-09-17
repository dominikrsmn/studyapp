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
    $executeRaw: jest.fn(),
    learningGraph: { findUnique: jest.fn(), update: jest.fn() },
    topic: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    learningGraph: { updateMany: jest.fn() },
  };
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
    prisma.learningGraph.updateMany.mockResolvedValue({ count: 0 });
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
    expect(transaction.topic.updateMany).toHaveBeenCalledWith({
      where: { moduleId: data.moduleId, published: true },
      data: { published: false },
    });
    expect(transaction.topic.updateMany).toHaveBeenCalledWith({
      where: { moduleId: data.moduleId, id: { in: proposal.topicIds } },
      data: { published: true },
    });
    expect(transaction.$executeRaw.mock.calls[0][0].values).toEqual([
      JSON.stringify(proposal.topicIds),
    ]);
    expect(transaction.$executeRaw.mock.calls[1][0].values).toEqual([
      JSON.stringify([
        { topicId: 'topic-a', prerequisiteId: 'topic-b' },
        { topicId: 'topic-b', prerequisiteId: 'topic-c' },
      ]),
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

  it('publishes 120 topics within the unchanged transaction budget', async () => {
    const topicIds = Array.from(
      { length: 120 },
      (_, index) => `topic-${index}`,
    );
    job.getChildrenValues = jest.fn().mockResolvedValue({
      'detect-cycles': { topicIds, dependencies: [] },
    });
    let elapsed = 0;
    const query = async () => {
      elapsed += 50;
      if (elapsed > 5000) {
        throw new Error('A query cannot be executed on an expired transaction');
      }
      return {};
    };
    transaction.topic.update.mockImplementation(query);
    transaction.$executeRaw.mockImplementation(query);
    transaction.topic.updateMany.mockImplementation(query);
    transaction.learningGraph.update.mockImplementation(query);

    await expect(refineGraphJob.process(job)).resolves.toBeUndefined();
    expect(transaction.learningGraph.update).toHaveBeenCalled();
  });

  it('publishes isolated topics alongside connected topics', async () => {
    job.getChildrenValues = jest.fn().mockResolvedValue({
      'detect-cycles': {
        ...proposal,
        topicIds: [...proposal.topicIds, 'isolated'],
      },
    });

    await refineGraphJob.process(job);

    expect(transaction.topic.updateMany).toHaveBeenCalledWith({
      where: {
        moduleId: data.moduleId,
        id: { in: [...proposal.topicIds, 'isolated'] },
      },
      data: { published: true },
    });
  });

  it('replaces published membership with an empty successful graph', async () => {
    job.getChildrenValues = jest.fn().mockResolvedValue({
      'detect-cycles': { topicIds: [], dependencies: [] },
    });

    await refineGraphJob.process(job);

    expect(transaction.topic.updateMany).toHaveBeenCalledWith({
      where: { moduleId: data.moduleId, published: true },
      data: { published: false },
    });
    expect(transaction.topic.update).not.toHaveBeenCalled();
    expect(transaction.learningGraph.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it.each([false, true])(
    'replaces membership and relationships only on a committed publication (failure: %s)',
    async (failCompletion) => {
      let stored = {
        status: 'QUEUED',
        topics: [
          { id: 'old', published: true, prerequisiteIds: ['topic-c'] },
          { id: 'topic-a', published: false, prerequisiteIds: [] as string[] },
          { id: 'topic-b', published: false, prerequisiteIds: [] as string[] },
          { id: 'topic-c', published: true, prerequisiteIds: [] as string[] },
          { id: 'isolated', published: false, prerequisiteIds: [] as string[] },
        ],
      };
      const previous = structuredClone(stored);
      job.getChildrenValues = jest.fn().mockResolvedValue({
        'detect-cycles': {
          ...proposal,
          topicIds: [...proposal.topicIds, 'isolated'],
        },
      });
      prisma.$transaction.mockImplementationOnce(async (operation) => {
        const pending = structuredClone(stored);
        transaction.topic.updateMany.mockImplementation(
          async ({ where, data }) => {
            for (const topic of pending.topics) {
              if (
                where.id
                  ? where.id.in.includes(topic.id)
                  : topic.published === where.published
              )
                topic.published = data.published;
            }
          },
        );
        transaction.$executeRaw.mockImplementation(
          async ({ strings, values }) => {
            if (strings.join('').includes('DELETE')) {
              const topicIds: string[] = JSON.parse(values[0]);
              for (const topic of pending.topics) {
                if (topicIds.includes(topic.id)) topic.prerequisiteIds = [];
              }
            } else {
              const dependencies: {
                topicId: string;
                prerequisiteId: string;
              }[] = JSON.parse(values[0]);
              for (const { topicId, prerequisiteId } of dependencies) {
                pending.topics
                  .find((topic) => topic.id === topicId)!
                  .prerequisiteIds.push(prerequisiteId);
              }
            }
            return 1;
          },
        );
        transaction.learningGraph.update.mockImplementation(
          async ({ data }) => {
            if (failCompletion) throw new Error('Completion failed');
            pending.status = data.status;
          },
        );
        const result = await operation(transaction);
        stored = pending;
        return result;
      });

      if (failCompletion) {
        await expect(refineGraphJob.process(job)).rejects.toThrow(
          'Completion failed',
        );
        expect(stored).toEqual(previous);
      } else {
        await refineGraphJob.process(job);
        expect(stored.status).toBe('COMPLETED');
        expect(stored.topics.filter((topic) => topic.published)).toEqual([
          { id: 'topic-a', published: true, prerequisiteIds: ['topic-b'] },
          { id: 'topic-b', published: true, prerequisiteIds: ['topic-c'] },
          { id: 'topic-c', published: true, prerequisiteIds: [] },
          { id: 'isolated', published: true, prerequisiteIds: [] },
        ]);
      }
    },
  );

  it('does not publish or complete after the module version changes', async () => {
    transaction.$queryRaw.mockResolvedValue([]);

    await refineGraphJob.process(job);

    expect(transaction.learningGraph.findUnique).not.toHaveBeenCalled();
    expect(transaction.topic.updateMany).not.toHaveBeenCalled();
    expect(transaction.topic.update).not.toHaveBeenCalled();
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
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
        errorMessage: 'Graph build became stale before publication',
      },
    });
  });

  it('does not publish when the graph build is no longer eligible', async () => {
    transaction.learningGraph.findUnique.mockResolvedValue(null);

    await refineGraphJob.process(job);

    expect(transaction.topic.updateMany).not.toHaveBeenCalled();
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
    transaction.$executeRaw.mockRejectedValueOnce(
      new Error('Prerequisite write failed'),
    );

    await expect(refineGraphJob.process(job)).rejects.toThrow(
      'Prerequisite write failed',
    );
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });
});
