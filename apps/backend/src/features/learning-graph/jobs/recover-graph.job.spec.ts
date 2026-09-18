import type { Job } from 'bullmq';
import type {
  GroupedGraphProposal,
  RecoverGraphJobData,
} from '../graph-build.types';
import type { GroupTopicsJob } from './group-topics.job';
import type { PublishGraphJob } from './publish-graph.job';
import { RecoverGraphJob } from './recover-graph.job';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class OpenAiService {},
}));
jest.mock('../../../infrastructure/database/generated/client', () => ({
  Prisma: {},
}));

describe('RecoverGraphJob', () => {
  const refinedProposal = {
    topicIds: ['topic-id'],
    dependencies: [],
  };
  const groupedProposal: GroupedGraphProposal = {
    ...refinedProposal,
    units: [
      {
        id: 'topic-id',
        title: 'Unit',
        summary: 'Summary',
        topicIds: ['topic-id'],
        entryTopicId: 'topic-id',
        exitTopicIds: ['topic-id'],
      },
    ],
    ordering: [],
  };
  const grouping = { processProposal: jest.fn() };
  const publication = { processProposal: jest.fn() };
  const recovery = new RecoverGraphJob(
    grouping as unknown as GroupTopicsJob,
    publication as unknown as PublishGraphJob,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    grouping.processProposal.mockResolvedValue(groupedProposal);
  });

  it('groups retained refinement and proceeds through publication', async () => {
    const data: RecoverGraphJobData = {
      graphId: 'graph-id',
      moduleId: 'module-id',
      graphVersion: 7,
      stage: 'GROUPING',
      proposal: refinedProposal,
    };
    const job = {
      data,
      updateData: jest.fn(),
    } as unknown as Job<RecoverGraphJobData>;

    await recovery.process(job);

    expect(grouping.processProposal).toHaveBeenCalledWith(
      data,
      refinedProposal,
    );
    expect(job.updateData).toHaveBeenCalledWith({
      ...data,
      stage: 'PUBLICATION',
      proposal: groupedProposal,
    });
    expect(publication.processProposal).toHaveBeenCalledWith(
      data,
      groupedProposal,
    );
  });

  it('retries retained publication without grouping or AI work', async () => {
    const data: RecoverGraphJobData = {
      graphId: 'graph-id',
      moduleId: 'module-id',
      graphVersion: 7,
      stage: 'PUBLICATION',
      proposal: groupedProposal,
    };
    const job = {
      data,
      updateData: jest.fn(),
    } as unknown as Job<RecoverGraphJobData>;

    await recovery.process(job);

    expect(grouping.processProposal).not.toHaveBeenCalled();
    expect(job.updateData).not.toHaveBeenCalled();
    expect(publication.processProposal).toHaveBeenCalledWith(
      data,
      groupedProposal,
    );
  });

  it('retains grouping output when publication fails and retries only publication', async () => {
    const data: RecoverGraphJobData = {
      graphId: 'graph-id',
      moduleId: 'module-id',
      graphVersion: 7,
      stage: 'GROUPING',
      proposal: refinedProposal,
    };
    const job = {
      data,
      updateData: jest.fn(async (updated: RecoverGraphJobData) => {
        job.data = updated;
      }),
    } as unknown as Job<RecoverGraphJobData>;
    publication.processProposal.mockRejectedValueOnce(
      new Error('Database unavailable'),
    );

    await expect(recovery.process(job)).rejects.toThrow('Database unavailable');
    await recovery.process(job);

    expect(grouping.processProposal).toHaveBeenCalledTimes(1);
    expect(publication.processProposal).toHaveBeenCalledTimes(2);
    expect(job.data).toEqual({
      ...data,
      stage: 'PUBLICATION',
      proposal: groupedProposal,
    });
  });
});
