import type { Prisma } from '../../infrastructure/database/generated/client';
import { invalidateSourceTopics } from './content-revision';

describe('invalidateSourceTopics', () => {
  const transaction = {
    topic: { updateMany: jest.fn() },
    module: { update: jest.fn().mockResolvedValue({ graphVersion: 2 }) },
    source: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ moduleId: 'module-id' }),
    },
  };
  beforeEach(() => jest.clearAllMocks());

  it('invalidates each affected canonical topic once and advances its module', async () => {
    transaction.topic.updateMany.mockResolvedValue({ count: 2 });
    await invalidateSourceTopics(
      transaction as unknown as Prisma.TransactionClient,
      'source-id',
    );
    expect(transaction.topic.updateMany).toHaveBeenCalledWith({
      where: { sourceTopics: { some: { sourceId: 'source-id' } } },
      data: {
        contentRevision: { increment: 1 },
        summary: null,
        summaryRevision: null,
      },
    });
    expect(transaction.module.update).toHaveBeenCalledWith({
      where: { id: 'module-id' },
      data: { graphVersion: { increment: 1 } },
      select: { graphVersion: true },
    });
  });

  it('advances graph inputs even when the source has no canonical evidence', async () => {
    transaction.topic.updateMany.mockResolvedValue({ count: 0 });
    await invalidateSourceTopics(
      transaction as unknown as Prisma.TransactionClient,
      'source-id',
    );
    expect(transaction.module.update).toHaveBeenCalledTimes(1);
  });
});
