import type { Job } from 'bullmq';
import type { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { GraphBuildJobData } from '../graph-build.types';
import { RefineGraphJob } from './refine-graph.job';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

describe('RefineGraphJob', () => {
  it('returns a reduced proposal including isolated topics without publishing', async () => {
    const prisma = { $transaction: jest.fn() };
    const job = {
      getChildrenValues: jest.fn().mockResolvedValue({
        cycles: {
          topicIds: ['a', 'b', 'c', 'isolated'],
          dependencies: [
            { topicId: 'a', dependsOnTopicId: 'b' },
            { topicId: 'a', dependsOnTopicId: 'c' },
            { topicId: 'b', dependsOnTopicId: 'c' },
          ],
        },
      }),
    } as unknown as Job<GraphBuildJobData>;
    await expect(
      new RefineGraphJob(prisma as unknown as PrismaService).process(job),
    ).resolves.toEqual({
      topicIds: ['a', 'b', 'c', 'isolated'],
      dependencies: [
        { topicId: 'a', dependsOnTopicId: 'b' },
        { topicId: 'b', dependsOnTopicId: 'c' },
      ],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
