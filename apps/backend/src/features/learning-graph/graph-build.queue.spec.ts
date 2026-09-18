import type { FlowProducer } from 'bullmq';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { EmbeddingBatchingService } from '../../infrastructure/embedding/embedding-batching.service';
import { embeddingConfig } from '../../infrastructure/config/embedding.config';
import { GraphBuildQueue } from './graph-build.queue';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../infrastructure/database/generated/client', () => ({
  Prisma: { sql: (strings: TemplateStringsArray) => strings.join('?') },
}));

describe('GraphBuildQueue', () => {
  it('keeps identical batches and job IDs when embeddings finish between requests', async () => {
    const flowProducer = { add: jest.fn() };
    let embeddingFinished = false;
    const prisma = {
      $queryRaw: jest.fn(async (sql: string) => {
        const prefix = sql.includes('FROM "Topic"') ? 'topic' : 'evidence';
        const ids = [{ id: `${prefix}-1` }, { id: `${prefix}-2` }];
        return embeddingFinished && sql.includes('IS NULL')
          ? ids.slice(1)
          : ids;
      }),
    };
    const queue = new GraphBuildQueue(
      flowProducer as unknown as FlowProducer,
      prisma as unknown as PrismaService,
      new EmbeddingBatchingService({ ...embeddingConfig(), batchSize: 1 }),
    );
    const data = {
      graphId: 'graph-id',
      moduleId: 'module-id',
      graphVersion: 7,
    };

    await queue.addEmbeddingFlow(data);
    embeddingFinished = true;
    await queue.addEmbeddingFlow(data);

    const [first, second] = flowProducer.add.mock.calls.map(([flow]) => flow);
    expect(second).toEqual(first);
    expect(first.children).toHaveLength(4);
    expect(first.children.map(({ data }: { data: object }) => data)).toEqual([
      { ...data, topicIds: ['topic-1'] },
      { ...data, topicIds: ['topic-2'] },
      { ...data, topicEvidenceIds: ['evidence-1'] },
      { ...data, topicEvidenceIds: ['evidence-2'] },
    ]);
  });

  it('propagates embedding, prerequisite-selection, and cycle-resolution failures', async () => {
    const flowProducer = { add: jest.fn() };
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'topic-1' }])
        .mockResolvedValueOnce([{ id: 'evidence-1' }]),
    };
    const queue = new GraphBuildQueue(
      flowProducer as unknown as FlowProducer,
      prisma as unknown as PrismaService,
      new EmbeddingBatchingService({ ...embeddingConfig(), batchSize: 1 }),
    );
    const data = {
      graphId: 'graph-id',
      moduleId: 'module-id',
      graphVersion: 7,
    };

    await queue.addEmbeddingFlow(data);
    await queue.addGraphFlow(data, ['topic-1', 'topic-2']);

    const embeddingFlow = flowProducer.add.mock.calls[0][0];
    expect(
      embeddingFlow.children.map(
        ({ opts }: { opts: { failParentOnFailure?: boolean } }) =>
          opts.failParentOnFailure,
      ),
    ).toEqual([true, true]);

    const graphFlow = flowProducer.add.mock.calls[1][0];
    expect(graphFlow.name).toBe('publish-graph');
    expect(graphFlow.opts).toEqual(
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: false,
        removeOnFail: false,
      }),
    );
    const grouping = graphFlow.children[0];
    const refinement = grouping.children[0];
    const cycles = refinement.children[0];
    expect([grouping.name, refinement.name, cycles.name]).toEqual([
      'group-topics',
      'refine-graph',
      'detect-cycles',
    ]);
    expect(
      [grouping, refinement, cycles].every(
        (job) => job.opts.failParentOnFailure,
      ),
    ).toBe(true);
    expect(
      cycles.children.map(
        ({ opts }: { opts: { failParentOnFailure?: boolean } }) =>
          opts.failParentOnFailure,
      ),
    ).toEqual([true, true]);
  });

  it('retains recovery input in one restartable job', async () => {
    const flowProducer = { add: jest.fn() };
    const queue = new GraphBuildQueue(
      flowProducer as unknown as FlowProducer,
      {} as PrismaService,
      new EmbeddingBatchingService({ ...embeddingConfig(), batchSize: 1 }),
    );
    const data = {
      graphId: 'graph-id',
      moduleId: 'module-id',
      graphVersion: 7,
      stage: 'GROUPING' as const,
      proposal: { topicIds: ['topic-id'], dependencies: [] },
    };

    await queue.addRecovery(data);

    expect(flowProducer.add).toHaveBeenCalledWith({
      name: 'recover-graph',
      queueName: 'learning-graph',
      data,
      opts: {
        jobId: 'recover-graph/graph-id/7',
        removeOnComplete: false,
        removeOnFail: false,
      },
    });
  });
});
