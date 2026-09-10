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
});
