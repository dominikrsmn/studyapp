import { TopicState } from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { analysisConfig } from '../analysis.config';
import { AnalysisQueue } from '../analysis.queue';
import { SummarizeTopicJob } from './summarize-topic.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class OpenAiService {},
}));
jest.mock('../analysis.queue', () => ({
  AnalysisQueue: class AnalysisQueue {},
}));

describe('SummarizeTopicJob', () => {
  const topicId = 'topic-id';
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const parse = jest.fn();
  const addSummarizeTopic = jest.fn();
  const config = analysisConfig();
  let job: SummarizeTopicJob;

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({
      title: 'Mutual Exclusion',
      description: 'Coordinating access to shared resources.',
      state: TopicState.CONFIRMED,
      contentRevision: 3,
      summaryRevision: 2,
      sourceTopics: [
        {
          evidence: [{ content: 'A mutex protects a critical section.' }],
        },
      ],
    });
    updateMany.mockResolvedValue({ count: 1 });
    parse.mockResolvedValue({ output_parsed: { summary: ' New summary. ' } });
    addSummarizeTopic.mockResolvedValue(undefined);

    job = new SummarizeTopicJob(
      {
        topic: { findUnique, updateMany },
      } as unknown as PrismaService,
      { client: { responses: { parse } } } as unknown as OpenAiService,
      { addSummarizeTopic } as unknown as AnalysisQueue,
      config,
    );
  });

  it('writes a summary only against the revision used to generate it', async () => {
    await job.process({ topicId, contentRevision: 3 });

    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: config.topicSummaryGeneration.model,
        reasoning: {
          effort: config.topicSummaryGeneration.reasoningEffort,
        },
      }),
    );
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: topicId,
        contentRevision: 3,
        state: { not: TopicState.REJECTED },
      },
      data: { summary: 'New summary.', summaryRevision: 3 },
    });
  });

  it('supersedes a stale queued revision without calling the model', async () => {
    await job.process({ topicId, contentRevision: 2 });

    expect(addSummarizeTopic).toHaveBeenCalledWith(topicId, 3);
    expect(parse).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('does not summarize rejected topics', async () => {
    findUnique.mockResolvedValue({
      title: 'Administrative Notes',
      description: 'Suppressed content.',
      state: TopicState.REJECTED,
      contentRevision: 3,
      summaryRevision: null,
      sourceTopics: [],
    });

    await job.process({ topicId, contentRevision: 3 });

    expect(parse).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
