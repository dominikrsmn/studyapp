import type { Prisma } from '../../infrastructure/database/generated/client';

export async function invalidateSourceTopics(
  transaction: Prisma.TransactionClient,
  sourceId: string,
): Promise<{ moduleId: string; graphVersion: number }> {
  await transaction.topic.updateMany({
    where: { sourceTopics: { some: { sourceId } } },
    data: {
      contentRevision: { increment: 1 },
      summary: null,
      summaryRevision: null,
    },
  });
  const source = await transaction.source.findUniqueOrThrow({
    where: { id: sourceId },
    select: { moduleId: true },
  });
  const module = await transaction.module.update({
    where: { id: source.moduleId },
    data: { graphVersion: { increment: 1 } },
    select: { graphVersion: true },
  });
  return { moduleId: source.moduleId, graphVersion: module.graphVersion };
}
