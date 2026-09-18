import type { Queue } from 'bullmq';
import type { GraphBuildJobData } from './graph-build.types';
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
    {} as Queue<GraphBuildJobData>,
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

describe('LearningGraphService recovery status', () => {
  const graph = {
    id: 'graph-id',
    version: 4,
    status: 'FAILED',
    errorMessage: 'Build failed',
  };
  const prisma = {
    module: { findFirst: jest.fn() },
    learningGraph: { findFirst: jest.fn() },
  };
  const queue = { getJob: jest.fn() };
  const service = new LearningGraphService(
    prisma as unknown as PrismaService,
    {} as GraphBuildQueue,
    queue as unknown as Queue<GraphBuildJobData>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.module.findFirst.mockResolvedValue({ graphVersion: 4 });
    prisma.learningGraph.findFirst.mockResolvedValue(graph);
    queue.getJob.mockResolvedValue(null);
  });

  it('offers publication recovery only when grouped output exists', async () => {
    const publicationJob = {
      isFailed: jest.fn(async () => true),
      getChildrenValues: jest.fn(async () => ({
        grouping: {
          topicIds: ['topic-id'],
          dependencies: [],
          units: [],
          ordering: [],
        },
      })),
    };
    queue.getJob.mockImplementation(async (id: string) =>
      id === 'publish-graph/graph-id/4' ? publicationJob : null,
    );

    await expect(
      service.findLatest('semester-id', 'module-id'),
    ).resolves.toEqual({
      ...graph,
      current: true,
      retryableStage: 'PUBLICATION',
    });
  });

  it('offers grouping recovery only when refined output exists', async () => {
    const groupingJob = {
      isFailed: jest.fn(async () => true),
      getChildrenValues: jest.fn(async () => ({
        refinement: { topicIds: ['topic-id'], dependencies: [] },
      })),
    };
    queue.getJob.mockImplementation(async (id: string) =>
      id === 'group-topics/graph-id/4' ? groupingJob : null,
    );

    await expect(
      service.findLatest('semester-id', 'module-id'),
    ).resolves.toEqual({
      ...graph,
      current: true,
      retryableStage: 'GROUPING',
    });
  });

  it('reports the retained stage from a failed recovery job', async () => {
    queue.getJob.mockImplementation(async (id: string) =>
      id === 'recover-graph/graph-id/4'
        ? {
            data: {
              ...graph,
              graphId: graph.id,
              moduleId: 'module-id',
              graphVersion: graph.version,
              stage: 'PUBLICATION',
              proposal: {
                topicIds: ['topic-id'],
                dependencies: [],
                units: [],
                ordering: [],
              },
            },
            isFailed: jest.fn(async () => true),
          }
        : null,
    );

    await expect(
      service.findLatest('semester-id', 'module-id'),
    ).resolves.toEqual(
      expect.objectContaining({ retryableStage: 'PUBLICATION' }),
    );
  });

  it('offers no recovery for missing results or changed sources', async () => {
    await expect(
      service.findLatest('semester-id', 'module-id'),
    ).resolves.toEqual(expect.objectContaining({ retryableStage: null }));
    expect(queue.getJob).toHaveBeenCalled();

    jest.clearAllMocks();
    prisma.module.findFirst.mockResolvedValue({ graphVersion: 5 });
    prisma.learningGraph.findFirst.mockResolvedValue(graph);
    await expect(
      service.findLatest('semester-id', 'module-id'),
    ).resolves.toEqual(
      expect.objectContaining({ current: false, retryableStage: null }),
    );
    expect(queue.getJob).not.toHaveBeenCalled();
  });
});

describe('LearningGraphService published reads', () => {
  const publishedTopic = {
    id: 'published',
    title: 'Published topic',
    description: 'Kept after source deletion',
    published: true,
    prerequisites: [{ id: 'isolated' }],
  };
  const isolatedTopic = {
    id: 'isolated',
    title: 'Foundation',
    description: 'A published foundation',
    published: true,
    prerequisites: [],
  };
  const topics = [
    publishedTopic,
    isolatedTopic,
    {
      id: 'new',
      title: 'New analysis',
      description: 'Not yet published',
      published: false,
      prerequisites: [],
    },
  ];
  const transaction = {
    module: { findFirst: jest.fn() },
    learningGraph: { findFirst: jest.fn() },
    topic: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  const prisma = { $transaction: jest.fn() };
  const service = new LearningGraphService(
    prisma as unknown as PrismaService,
    {} as GraphBuildQueue,
    {} as Queue<GraphBuildJobData>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    transaction.$queryRaw.mockResolvedValue([]);
    transaction.module.findFirst.mockImplementation(async ({ where }) =>
      where.semesterId === 'active-semester' && where.id === 'module-id'
        ? { id: 'module-id' }
        : null,
    );
    transaction.learningGraph.findFirst.mockResolvedValue({
      id: 'published-build',
      version: 7,
    });
    transaction.topic.findMany.mockImplementation(async ({ where }) =>
      topics
        .filter((topic) => topic.published === where.published)
        .map(({ published, ...topic }) => topic),
    );
  });

  it.each(['QUEUED', 'FAILED'])(
    'returns exact published membership with a newer %s build',
    async (status) => {
      const builds = [
        { id: 'new-build', version: 8, status },
        { id: 'published-build', version: 7, status: 'COMPLETED' },
      ];
      transaction.learningGraph.findFirst.mockImplementation(
        async ({ where, orderBy }) => {
          const build = builds
            .filter((build) => build.status === where.status)
            .sort((a, b) =>
              orderBy.version === 'desc'
                ? b.version - a.version
                : a.version - b.version,
            )[0];
          return build ? { id: build.id, version: build.version } : null;
        },
      );

      await expect(
        service.findPublished('active-semester', 'module-id'),
      ).resolves.toEqual({
        id: 'published-build',
        version: 7,
        units: [],
        ordering: [],
        topics: [
          {
            id: 'published',
            title: 'Published topic',
            description: 'Kept after source deletion',
            prerequisiteIds: ['isolated'],
          },
          {
            id: 'isolated',
            title: 'Foundation',
            description: 'A published foundation',
            prerequisiteIds: [],
          },
        ],
      });
    },
  );

  it('reads units and ordering within the same publication snapshot', async () => {
    const units = [
      {
        id: 'isolated',
        title: 'Foundation',
        summary: 'Scope',
        topicIds: ['isolated', 'published'],
        entryTopicId: 'isolated',
        exitTopicIds: ['published'],
      },
    ];
    const ordering = [
      { sourceUnitId: 'isolated', destinationUnitId: 'next-unit' },
    ];
    transaction.$queryRaw
      .mockResolvedValueOnce(units)
      .mockResolvedValueOnce(ordering);
    const result = await service.findPublished('active-semester', 'module-id');
    expect(result).toEqual(
      expect.objectContaining({ id: 'published-build', units, ordering }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
    expect(
      transaction.$queryRaw.mock.calls.map(([, moduleId]) => moduleId),
    ).toEqual(['module-id', 'module-id']);
  });

  it('rejects modules outside the active semester', async () => {
    await expect(
      service.findPublished('other-semester', 'module-id'),
    ).rejects.toThrow('was not found');
    expect(transaction.topic.findMany).not.toHaveBeenCalled();
  });

  it('returns null before the first successful publication', async () => {
    transaction.learningGraph.findFirst.mockResolvedValue(null);
    await expect(
      service.findPublished('active-semester', 'module-id'),
    ).resolves.toBeNull();
  });

  it('preserves the identity of an empty successful publication', async () => {
    transaction.topic.findMany.mockResolvedValue([]);
    await expect(
      service.findPublished('active-semester', 'module-id'),
    ).resolves.toEqual({
      id: 'published-build',
      version: 7,
      units: [],
      ordering: [],
      topics: [],
    });
  });
});

describe('manual graph publication recovery', () => {
  const graph = {
    id: 'graph-id',
    version: 4,
    status: 'FAILED',
    errorMessage: 'Timed out',
  };
  const job = {
    getChildrenValues: jest.fn(),
    isFailed: jest.fn(),
    retry: jest.fn(),
    updateData: jest.fn(),
  };
  const queue = { getJob: jest.fn() };
  const buildQueue = { addEmbeddingFlow: jest.fn() };
  const transaction = {
    $queryRaw: jest.fn(),
    learningGraph: { updateMany: jest.fn() },
  };
  const prisma = {
    module: { findFirst: jest.fn() },
    learningGraph: { findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new LearningGraphService(
    prisma as unknown as PrismaService,
    buildQueue as unknown as GraphBuildQueue,
    queue as unknown as Queue<GraphBuildJobData>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.module.findFirst.mockResolvedValue({ graphVersion: 4 });
    prisma.learningGraph.findFirst.mockResolvedValue(graph);
    queue.getJob.mockResolvedValue(job);
    job.isFailed.mockResolvedValue(true);
    job.getChildrenValues.mockResolvedValue({
      grouping: {
        topicIds: ['topic-id'],
        dependencies: [],
        units: [],
        ordering: [],
      },
    });
    transaction.$queryRaw.mockResolvedValue([{ id: 'module-id' }]);
    transaction.learningGraph.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
  });

  it('requeues only saved publication after restoring build eligibility', async () => {
    job.retry.mockImplementation(async () => {
      expect(transaction.learningGraph.updateMany).toHaveBeenCalledWith({
        where: { id: graph.id, status: 'FAILED' },
        data: { status: 'QUEUED', finishedAt: null, errorMessage: null },
      });
    });
    await service.retryPublication('semester-id', 'module-id');
    expect(queue.getJob).toHaveBeenCalledWith('publish-graph/graph-id/4');
    expect(job.retry).toHaveBeenCalledWith('failed');
    expect(buildQueue.addEmbeddingFlow).not.toHaveBeenCalled();
  });

  it('retries publication retained by a failed recovery without grouping', async () => {
    const recoveryJob = {
      data: {
        graphId: graph.id,
        moduleId: 'module-id',
        graphVersion: graph.version,
        stage: 'PUBLICATION',
        proposal: {
          topicIds: ['topic-id'],
          dependencies: [],
          units: [],
          ordering: [],
        },
      },
      isFailed: jest.fn(async () => true),
      retry: jest.fn(),
      updateData: jest.fn(),
    };
    queue.getJob.mockImplementation(async (id: string) =>
      id === 'recover-graph/graph-id/4' ? recoveryJob : null,
    );

    await service.retryPublication('semester-id', 'module-id');

    expect(recoveryJob.retry).toHaveBeenCalledWith('failed');
    expect(buildQueue.addEmbeddingFlow).not.toHaveBeenCalled();
  });

  it('rejects changed inputs without re-running AI work', async () => {
    prisma.module.findFirst.mockResolvedValue({ graphVersion: 5 });
    await expect(
      service.retryPublication('semester-id', 'module-id'),
    ).rejects.toThrow('unchanged source material');
    expect(queue.getJob).not.toHaveBeenCalled();
    expect(buildQueue.addEmbeddingFlow).not.toHaveBeenCalled();
  });

  it('rejects missing results without starting a replacement build', async () => {
    job.getChildrenValues.mockResolvedValue({});
    await expect(
      service.retryPublication('semester-id', 'module-id'),
    ).rejects.toThrow('No saved publication');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(buildQueue.addEmbeddingFlow).not.toHaveBeenCalled();
  });

  it('rechecks the revision before making a saved proposal eligible', async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(
      service.retryPublication('semester-id', 'module-id'),
    ).rejects.toThrow('Source material changed');
    expect(job.retry).not.toHaveBeenCalled();
  });

  it('records failure if requeueing fails', async () => {
    job.retry.mockRejectedValue(new Error('Queue unavailable'));
    await expect(
      service.retryPublication('semester-id', 'module-id'),
    ).rejects.toThrow('Queue unavailable');
    expect(prisma.learningGraph.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Could not retry publication: Queue unavailable',
        }),
      }),
    );
  });

  it('enforces module access before reading saved jobs', async () => {
    prisma.module.findFirst.mockResolvedValue(null);
    await expect(
      service.retryPublication('other-semester', 'module-id'),
    ).rejects.toThrow('Module was not found');
    expect(queue.getJob).not.toHaveBeenCalled();
  });
});

describe('manual graph grouping recovery', () => {
  const graph = {
    id: 'graph-id',
    version: 4,
    status: 'FAILED',
    errorMessage: 'Grouping failed',
  };
  const refinedProposal = {
    topicIds: ['topic-id'],
    dependencies: [],
  };
  const groupingJob = {
    getChildrenValues: jest.fn(),
    isFailed: jest.fn(),
    updateData: jest.fn(),
  };
  const publicationJob = { updateData: jest.fn(), data: {} };
  const queue = { getJob: jest.fn() };
  const buildQueue = { addRecovery: jest.fn() };
  const transaction = {
    $queryRaw: jest.fn(),
    learningGraph: { updateMany: jest.fn() },
  };
  const prisma = {
    module: { findFirst: jest.fn() },
    learningGraph: { findFirst: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new LearningGraphService(
    prisma as unknown as PrismaService,
    buildQueue as unknown as GraphBuildQueue,
    queue as unknown as Queue<GraphBuildJobData>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.module.findFirst.mockResolvedValue({ graphVersion: 4 });
    prisma.learningGraph.findFirst.mockResolvedValue(graph);
    queue.getJob.mockImplementation(async (id: string) => {
      if (id === 'group-topics/graph-id/4') return groupingJob;
      if (id === 'publish-graph/graph-id/4') return publicationJob;
      return null;
    });
    groupingJob.isFailed.mockResolvedValue(true);
    groupingJob.getChildrenValues.mockResolvedValue({
      refinement: refinedProposal,
    });
    transaction.$queryRaw.mockResolvedValue([{ id: 'module-id' }]);
    transaction.learningGraph.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
  });

  it('requeues grouping from the retained refined proposal', async () => {
    await service.retryGrouping('semester-id', 'module-id');

    expect(buildQueue.addRecovery).toHaveBeenCalledWith({
      graphId: graph.id,
      moduleId: 'module-id',
      graphVersion: graph.version,
      stage: 'GROUPING',
      proposal: refinedProposal,
    });
    expect(groupingJob.updateData).toHaveBeenCalledWith({
      recoveryRequested: true,
    });
    expect(publicationJob.updateData).toHaveBeenCalledWith({
      recoveryRequested: true,
    });
  });

  it('rejects grouping recovery without retained refinement', async () => {
    groupingJob.getChildrenValues.mockResolvedValue({});

    await expect(
      service.retryGrouping('semester-id', 'module-id'),
    ).rejects.toThrow('No saved grouping input');
    expect(buildQueue.addRecovery).not.toHaveBeenCalled();
  });

  it('records failure if enqueueing grouping recovery fails', async () => {
    buildQueue.addRecovery.mockRejectedValue(new Error('Queue unavailable'));

    await expect(
      service.retryGrouping('semester-id', 'module-id'),
    ).rejects.toThrow('Queue unavailable');
    expect(prisma.learningGraph.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Could not retry grouping: Queue unavailable',
        }),
      }),
    );
  });

  it('retries the same failed grouping recovery without creating competing work', async () => {
    const recoveryJob = {
      data: {
        graphId: graph.id,
        moduleId: 'module-id',
        graphVersion: graph.version,
        stage: 'GROUPING',
        proposal: refinedProposal,
      },
      isFailed: jest.fn(async () => true),
      retry: jest.fn(),
      updateData: jest.fn(),
    };
    queue.getJob.mockImplementation(async (id: string) =>
      id === 'recover-graph/graph-id/4' ? recoveryJob : null,
    );

    await service.retryGrouping('semester-id', 'module-id');

    expect(recoveryJob.retry).toHaveBeenCalledWith('failed');
    expect(buildQueue.addRecovery).not.toHaveBeenCalled();
  });

  it('does not restart grouping after recovery reached publication', async () => {
    queue.getJob.mockImplementation(async (id: string) =>
      id === 'recover-graph/graph-id/4'
        ? {
            data: { stage: 'PUBLICATION' },
            isFailed: jest.fn(async () => true),
          }
        : groupingJob,
    );

    await expect(
      service.retryGrouping('semester-id', 'module-id'),
    ).rejects.toThrow('Retry the saved publication');
    expect(buildQueue.addRecovery).not.toHaveBeenCalled();
  });

  it('rechecks source version before enqueueing recovery', async () => {
    transaction.$queryRaw.mockResolvedValue([]);

    await expect(
      service.retryGrouping('semester-id', 'module-id'),
    ).rejects.toThrow('Source material changed');
    expect(buildQueue.addRecovery).not.toHaveBeenCalled();
  });

  it('guards repeated grouping recovery requests', async () => {
    transaction.learningGraph.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.retryGrouping('semester-id', 'module-id'),
    ).rejects.toThrow('already being retried');
    expect(buildQueue.addRecovery).not.toHaveBeenCalled();
  });
});

describe('manual graph build requests', () => {
  const transaction = {
    $queryRaw: jest.fn(),
    module: { update: jest.fn() },
    learningGraph: { findFirst: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const service = new LearningGraphService(
    prisma as unknown as PrismaService,
    {} as GraphBuildQueue,
    {} as Queue<GraphBuildJobData>,
  );
  let regenerate: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    transaction.$queryRaw.mockResolvedValue([{ graphVersion: 4 }]);
    transaction.module.update.mockResolvedValue({ graphVersion: 5 });
    regenerate = jest.spyOn(service, 'regenerate').mockResolvedValue({
      graphId: 'graph',
      moduleId: 'module',
      graphVersion: 4,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([null, { status: 'QUEUED' }])(
    'reuses the current revision for an absent or queued build (%j)',
    async (existing) => {
      transaction.learningGraph.findFirst.mockResolvedValue(existing);
      await service.requestBuild('semester', 'module');
      expect(regenerate).toHaveBeenCalledWith('module', 4);
      expect(transaction.module.update).not.toHaveBeenCalled();
    },
  );

  it.each(['FAILED', 'COMPLETED'])(
    'explicit regeneration starts a new revision after %s',
    async (status) => {
      transaction.learningGraph.findFirst.mockResolvedValue({ status });
      await service.requestBuild('semester', 'module');
      expect(transaction.module.update).toHaveBeenCalledWith({
        where: { id: 'module' },
        data: { graphVersion: { increment: 1 } },
        select: { graphVersion: true },
      });
      expect(regenerate).toHaveBeenCalledWith('module', 5);
    },
  );

  it('rejects inaccessible modules before enqueuing work', async () => {
    transaction.$queryRaw.mockResolvedValue([]);
    await expect(
      service.requestBuild('other-semester', 'module'),
    ).rejects.toThrow('Module was not found');
    expect(regenerate).not.toHaveBeenCalled();
  });
});
