import type { Prisma } from '../../infrastructure/database/generated/client';

export async function invalidateSourceTopics(
  transaction: Prisma.TransactionClient,
  sourceId: string,
): Promise<void> {
  const changed = await transaction.topic.updateMany({
    where: { sourceTopics: { some: { sourceId } } },
    data: {
      contentRevision: { increment: 1 },
      summary: null,
      summaryRevision: null,
    },
  });
  if (changed.count > 0) {
    await transaction.module.updateMany({
      where: { sources: { some: { id: sourceId } } },
      data: { contentRevision: { increment: 1 } },
    });
  }
}
