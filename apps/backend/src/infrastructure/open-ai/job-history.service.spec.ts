import { JobHistoryService } from './job-history.service';
import { jobCostContext } from './job-cost-context';
import type { PrismaService } from '../database/prisma/prisma.service';
import type { Job } from 'bullmq';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class {},
}));

describe('JobHistoryService', () => {
  const create = jest.fn();
  const update = jest.fn();
  const findMany = jest.fn();
  const history = new JobHistoryService({
    sourceJob: { create, update },
    sourceTopic: { findMany },
  } as unknown as PrismaService);
  const job = {
    id: 'job-1',
    name: 'extract-source-topics',
    queueName: 'topic-analysis',
    attemptsMade: 1,
    data: { sourceId: 'source-1' },
  } as Job;

  beforeEach(() => {
    jest.clearAllMocks();
    create.mockImplementation(async ({ data }) => ({ id: data.jobId }));
    update.mockResolvedValue({});
  });

  it('isolates cost attribution between concurrent jobs and restores the caller context', async () => {
    const seen: string[] = [];
    await Promise.all(
      ['one', 'two'].map((id) =>
        history.run({ ...job, id } as Job, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          seen.push(jobCostContext.getStore()!);
        }),
      ),
    );
    expect(seen.sort()).toEqual(['one', 'two']);
    expect(jobCostContext.getStore()).toBeUndefined();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ attempt: 2, sourceIds: ['source-1'] }),
    });
  });

  it('retains a failed attempt and propagates its error', async () => {
    const error = new Error('AI failed');
    await expect(
      history.run(job, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(update).toHaveBeenCalledWith({
      where: { id: job.id },
      data: { state: 'FAILED', finishedAt: expect.any(Date) },
    });
  });

  it('snapshots the sources of a shared topic summary', async () => {
    findMany.mockResolvedValue([{ sourceId: 'a' }, { sourceId: 'b' }]);
    await history.run(
      { ...job, data: { topicId: 'topic' } } as Job,
      async () => undefined,
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sourceIds: ['a', 'b'] }),
    });
  });
});
