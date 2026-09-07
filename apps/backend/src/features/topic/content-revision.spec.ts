import type { Prisma } from '../../infrastructure/database/generated/client';
import { invalidateSourceTopics } from './content-revision';

describe('invalidateSourceTopics', () => {
  const transaction = {
    topic: { updateMany: jest.fn() },
    module: { updateMany: jest.fn() },
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
    expect(transaction.module.updateMany).toHaveBeenCalledWith({
      where: { sources: { some: { id: 'source-id' } } },
      data: { contentRevision: { increment: 1 } },
    });
  });

  it('leaves revisions unchanged when the source has no canonical evidence', async () => {
    transaction.topic.updateMany.mockResolvedValue({ count: 0 });
    await invalidateSourceTopics(
      transaction as unknown as Prisma.TransactionClient,
      'source-id',
    );
    expect(transaction.module.updateMany).not.toHaveBeenCalled();
  });
});
