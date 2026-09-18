import type { Job } from 'bullmq';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type {
  GroupedGraphProposal,
  PublishGraphJobData,
} from '../graph-build.types';
import { PublishGraphJob } from './publish-graph.job';

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

describe('PublishGraphJob', () => {
  const data: PublishGraphJobData = {
    graphId: 'graph-id',
    moduleId: 'module-id',
    graphVersion: 7,
  };
  const proposal: GroupedGraphProposal = {
    units: [
      {
        id: 'topic-a',
        title: 'Unit',
        summary: 'Summary',
        topicIds: ['topic-a', 'topic-b', 'topic-c'],
        entryTopicId: 'topic-c',
        exitTopicIds: ['topic-a'],
      },
    ],
    ordering: [],
    topicIds: ['topic-a', 'topic-b', 'topic-c'],
    dependencies: [
      { topicId: 'topic-a', dependsOnTopicId: 'topic-b' },
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
  } as unknown as Job<PublishGraphJobData>;
  const publishGraphJob = new PublishGraphJob(
    prisma as unknown as PrismaService,
  );

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
      .mockResolvedValue({ 'group-topics': proposal });
  });

  it('publishes a current proposal and completes its eligible graph build', async () => {
    await publishGraphJob.process(job);

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
    expect(transaction.$executeRaw.mock.calls[2][0].values).toEqual([
      data.moduleId,
    ]);
    expect(transaction.$executeRaw.mock.calls[3][0].values).toEqual([
      data.moduleId,
      JSON.stringify(proposal.units),
    ]);
    expect(transaction.$executeRaw.mock.calls[4][0].values).toEqual([
      JSON.stringify(proposal.ordering),
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
      'group-topics': { topicIds, dependencies: [], units: [], ordering: [] },
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

    await expect(publishGraphJob.process(job)).resolves.toBeUndefined();
    expect(transaction.learningGraph.update).toHaveBeenCalled();
  });

  it('publishes isolated topics alongside connected topics', async () => {
    job.getChildrenValues = jest.fn().mockResolvedValue({
      'group-topics': {
        ...proposal,
        topicIds: [...proposal.topicIds, 'isolated'],
      },
    });

    await publishGraphJob.process(job);

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
      'group-topics': {
        topicIds: [],
        dependencies: [],
        units: [],
        ordering: [],
      },
    });

    await publishGraphJob.process(job);

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
        units: [{ id: 'old-unit' }],
        ordering: [
          { sourceUnitId: 'old-unit', destinationUnitId: 'another-unit' },
        ],
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
        'group-topics': {
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
            const sql = strings.join('');
            if (sql.includes('DELETE FROM "LearningUnit"')) {
              pending.units = [];
              pending.ordering = [];
            } else if (sql.includes('INSERT INTO "LearningUnit"')) {
              pending.units = JSON.parse(values[1]);
            } else if (sql.includes('INSERT INTO "LearningUnitOrdering"')) {
              pending.ordering = JSON.parse(values[0]);
            } else if (sql.includes('DELETE')) {
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
        await expect(publishGraphJob.process(job)).rejects.toThrow(
          'Completion failed',
        );
        expect(stored).toEqual(previous);
      } else {
        await publishGraphJob.process(job);
        expect(stored.status).toBe('COMPLETED');
        expect(stored.units).toEqual(proposal.units);
        expect(stored.ordering).toEqual(proposal.ordering);
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

    await publishGraphJob.process(job);

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

    await publishGraphJob.process(job);

    expect(transaction.topic.updateMany).not.toHaveBeenCalled();
    expect(transaction.topic.update).not.toHaveBeenCalled();
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });

  it('does not clear prerequisites for a module topic absent from the proposal', async () => {
    transaction.topic.findMany.mockResolvedValue([
      ...proposal.topicIds.map((id) => ({ id })),
      { id: 'topic-outside-proposal' },
    ]);

    await publishGraphJob.process(job);

    expect(transaction.topic.findMany).not.toHaveBeenCalled();
    expect(transaction.topic.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'topic-outside-proposal' } }),
    );
  });

  it('replays the saved grouping proposal unchanged on publication retry', async () => {
    transaction.$executeRaw.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await expect(publishGraphJob.process(job)).rejects.toThrow(
      'Database unavailable',
    );
    await publishGraphJob.process(job);
    expect(transaction.$executeRaw.mock.calls.slice(-2)[0][0].values).toEqual([
      data.moduleId,
      JSON.stringify(proposal.units),
    ]);
    expect(transaction.$executeRaw.mock.calls.slice(-1)[0][0].values).toEqual([
      JSON.stringify(proposal.ordering),
    ]);
    expect(transaction.learningGraph.update).toHaveBeenCalledTimes(1);
  });

  it('does not complete the build when writing units fails', async () => {
    transaction.$executeRaw.mockImplementation(async ({ strings }) => {
      if (strings.join('').includes('INSERT INTO "LearningUnit"'))
        throw new Error('Unit write failed');
    });
    await expect(publishGraphJob.process(job)).rejects.toThrow(
      'Unit write failed',
    );
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });

  it('does not complete the build when prerequisite replacement fails', async () => {
    transaction.$executeRaw.mockRejectedValueOnce(
      new Error('Prerequisite write failed'),
    );

    await expect(publishGraphJob.process(job)).rejects.toThrow(
      'Prerequisite write failed',
    );
    expect(transaction.learningGraph.update).not.toHaveBeenCalled();
  });
});
