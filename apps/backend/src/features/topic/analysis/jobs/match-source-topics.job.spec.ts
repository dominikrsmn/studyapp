import { Logger } from '@nestjs/common';
import {
  ProcessingState,
  SourceProcessingStageType,
  TopicState,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { AnalysisQueue } from '../analysis.queue';
import {
  MatchSourceTopicsJob,
  sourceTopicMatchingPrompt,
  validateMatchingResult,
} from './match-source-topics.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class OpenAiService {},
}));
jest.mock('../../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));

describe('MatchSourceTopicsJob', () => {
  const sourceId = 'source-id';
  const sourceTopics = [
    sourceTopic('source-topic-0', 0, 'Dijkstra', 'Shortest paths', [
      'Greedily settle the nearest vertex.',
    ]),
    sourceTopic('source-topic-1', 1, 'Minimum Spanning Trees', 'MSTs', [
      'A spanning tree of minimum total edge weight.',
    ]),
    sourceTopic('source-topic-2', 2, 'Dijkstra Revisited', 'Runtime', [
      'A priority queue improves the runtime.',
    ]),
    sourceTopic('source-topic-3', 3, 'Course organization', 'Logistics', [
      'Office hours and submission dates.',
    ]),
    sourceTopic(
      'source-topic-4',
      4,
      'Stochastic Gradient Descent',
      'Mini-batch optimization',
      ['A gradient estimate is computed from a sampled mini-batch.'],
    ),
  ];
  const candidates = [
    candidateTopic(
      'topic-mst',
      'Minimum Spanning Trees',
      'Minimum-weight trees spanning a graph.',
      TopicState.CONFIRMED,
      ['Kruskal greedily selects safe edges.'],
    ),
    candidateTopic(
      'topic-logistics',
      'Lecture Logistics',
      'Non-subject-matter course organization.',
      TopicState.REJECTED,
      ['The lecture lists office hours.'],
    ),
    candidateTopic(
      'topic-sgd',
      'SGD',
      'A noisy optimization method.',
      TopicState.SUGGESTED,
      ['Updates use a sampled training example.'],
    ),
  ];
  const matchingResult = {
    canonicalTopics: [
      {
        canonicalKey: 'new-dijkstra',
        existingTopicId: null,
        title: "Dijkstra's Algorithm",
        description:
          'Single-source shortest paths with non-negative edge weights.',
      },
      {
        canonicalKey: 'existing-mst',
        existingTopicId: 'topic-mst',
        title: 'Minimum Spanning Trees',
        description: 'Minimum-weight trees spanning a graph.',
      },
      {
        canonicalKey: 'rejected-logistics',
        existingTopicId: 'topic-logistics',
        title: 'Lecture Logistics',
        description: 'Non-subject-matter course organization.',
      },
      {
        canonicalKey: 'suggested-sgd',
        existingTopicId: 'topic-sgd',
        title: 'Stochastic Gradient Descent',
        description:
          'Gradient-based optimization using estimates from sampled examples or mini-batches.',
      },
    ],
    assignments: [
      {
        sourceTopicId: 'source-topic-0',
        canonicalKey: 'new-dijkstra',
        decision: 'NEW_TOPIC',
        confidence: 0.95,
      },
      {
        sourceTopicId: 'source-topic-1',
        canonicalKey: 'existing-mst',
        decision: 'SAME_TOPIC',
        confidence: 0.98,
      },
      {
        sourceTopicId: 'source-topic-2',
        canonicalKey: 'new-dijkstra',
        decision: 'SAME_TOPIC',
        confidence: 0.93,
      },
      {
        sourceTopicId: 'source-topic-3',
        canonicalKey: 'rejected-logistics',
        decision: 'SAME_TOPIC',
        confidence: 0.9,
      },
      {
        sourceTopicId: 'source-topic-4',
        canonicalKey: 'suggested-sgd',
        decision: 'SAME_TOPIC',
        confidence: 0.96,
      },
    ],
  };
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const parse = jest.fn();
  const transition = jest.fn();
  const addFinalizeTopicAnalysis = jest.fn();
  const topicCreate = jest.fn();
  const topicUpdate = jest.fn();
  const sourceTopicUpdate = jest.fn();
  const transaction = {
    topic: { create: topicCreate, update: topicUpdate },
    sourceTopic: { update: sourceTopicUpdate },
  };
  const prismaService = {
    source: { findUnique },
    topic: { findMany },
    $transaction: jest.fn(),
  };
  const config = analysisConfig();
  let job: MatchSourceTopicsJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findUnique.mockResolvedValue({
      name: 'Algorithms notes',
      module: {
        id: 'module-id',
        name: 'Algorithms',
        description: 'Graph algorithms and optimization',
      },
      sourceTopics,
    });
    findMany.mockResolvedValue(candidates);
    parse.mockResolvedValue({ output_parsed: matchingResult });
    topicCreate.mockResolvedValue({ id: 'created-dijkstra' });
    topicUpdate.mockResolvedValue({});
    sourceTopicUpdate.mockResolvedValue({});
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    transition.mockResolvedValue({});
    addFinalizeTopicAnalysis.mockResolvedValue(undefined);

    job = new MatchSourceTopicsJob(
      prismaService as unknown as PrismaService,
      { client: { responses: { parse } } } as unknown as OpenAiService,
      { transition } as unknown as SourceProcessingStageService,
      { addFinalizeTopicAnalysis } as unknown as AnalysisQueue,
      config,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('matches all occurrences together and persists shared, existing, rejected, and refined identities', async () => {
    await expect(job.process({ sourceId })).resolves.toBeUndefined();

    expect(addFinalizeTopicAnalysis).toHaveBeenCalledWith(sourceId);

    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: config.sourceTopicMatching.model,
      reasoning: { effort: config.sourceTopicMatching.reasoningEffort },
      text: {
        format: {
          type: 'json_schema',
          name: 'matched_source_topics',
          strict: true,
        },
      },
    });
    const input = JSON.parse(request.input[1].content);
    expect(input.source.sourceTopics).toHaveLength(5);
    expect(input.source.sourceTopics[0].evidence).toEqual([
      {
        content: 'Greedily settle the nearest vertex.',
        confidence: null,
        spans: [{ content: 'Greedily settle the nearest vertex.' }],
      },
    ]);
    expect(input.candidateCanonicalTopics[0].sourceTopics[0].evidence).toEqual([
      {
        content: 'Kruskal greedily selects safe edges.',
        confidence: null,
        spans: [{ content: 'Kruskal greedily selects safe edges.' }],
      },
    ]);
    expect(input.candidateCanonicalTopics[1].state).toBe(TopicState.REJECTED);

    expect(topicCreate).toHaveBeenCalledTimes(1);
    expect(topicCreate).toHaveBeenCalledWith({
      data: {
        moduleId: 'module-id',
        title: "Dijkstra's Algorithm",
        description:
          'Single-source shortest paths with non-negative edge weights.',
        state: TopicState.SUGGESTED,
      },
      select: { id: true },
    });
    expect(topicUpdate).toHaveBeenCalledWith({
      where: { id: 'topic-mst' },
      data: { contentRevision: { increment: 1 } },
    });
    expect(topicUpdate).toHaveBeenCalledWith({
      where: { id: 'topic-logistics' },
      data: { contentRevision: { increment: 1 } },
    });
    expect(topicUpdate).toHaveBeenCalledWith({
      where: { id: 'topic-sgd' },
      data: {
        title: 'Stochastic Gradient Descent',
        description:
          'Gradient-based optimization using estimates from sampled examples or mini-batches.',
        contentRevision: { increment: 1 },
      },
    });

    expect(sourceTopicUpdate).toHaveBeenCalledTimes(5);
    expect(sourceTopicUpdate).toHaveBeenCalledWith({
      where: { id: 'source-topic-0' },
      data: {
        topicId: 'created-dijkstra',
        canonicalizationConfidence: 0.95,
      },
    });
    expect(sourceTopicUpdate).toHaveBeenCalledWith({
      where: { id: 'source-topic-2' },
      data: {
        topicId: 'created-dijkstra',
        canonicalizationConfidence: 0.93,
      },
    });
    expect(sourceTopicUpdate).toHaveBeenCalledWith({
      where: { id: 'source-topic-3' },
      data: {
        topicId: 'topic-logistics',
        canonicalizationConfidence: 0.9,
      },
    });
  });

  it('is idempotent when every source occurrence is already attached', async () => {
    findUnique.mockResolvedValue({
      name: 'Algorithms notes',
      module: { id: 'module-id', name: 'Algorithms', description: null },
      sourceTopics: [],
    });

    await expect(job.process({ sourceId })).resolves.toBeUndefined();

    expect(findMany).not.toHaveBeenCalled();
    expect(parse).not.toHaveBeenCalled();
    expect(prismaService.$transaction).not.toHaveBeenCalled();
    expect(addFinalizeTopicAnalysis).toHaveBeenCalledWith(sourceId);
  });

  it('fails the analysis stage when the model omits an occurrence', async () => {
    parse.mockResolvedValue({
      output_parsed: {
        ...matchingResult,
        assignments: matchingResult.assignments.slice(1),
      },
    });

    await expect(job.process({ sourceId })).rejects.toThrow(
      'Every incoming source topic must be assigned exactly once',
    );
    expect(prismaService.$transaction).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
  });
});

describe('validateMatchingResult', () => {
  it('keeps uncertain identities separate', () => {
    expect(() =>
      validateMatchingResult(
        {
          canonicalTopics: [
            {
              canonicalKey: 'uncertain',
              existingTopicId: null,
              title: 'Possibly Dijkstra',
              description: 'An uncertain shortest-path concept.',
            },
          ],
          assignments: [
            {
              sourceTopicId: 'source-topic-0',
              canonicalKey: 'uncertain',
              decision: 'UNCERTAIN',
              confidence: 0.4,
            },
            {
              sourceTopicId: 'source-topic-1',
              canonicalKey: 'uncertain',
              decision: 'SAME_TOPIC',
              confidence: 0.4,
            },
          ],
        },
        ['source-topic-0', 'source-topic-1'],
        [],
      ),
    ).toThrow('UNCERTAIN source topics must remain separate');
  });

  it('does not allow related-but-distinct occurrences to attach to an existing topic', () => {
    expect(() =>
      validateMatchingResult(
        {
          canonicalTopics: [
            {
              canonicalKey: 'gradient-descent',
              existingTopicId: 'topic-gradient-descent',
              title: 'Gradient Descent',
              description: 'Full-batch gradient optimization.',
            },
          ],
          assignments: [
            {
              sourceTopicId: 'source-topic-sgd',
              canonicalKey: 'gradient-descent',
              decision: 'RELATED_BUT_DISTINCT',
              confidence: 0.95,
            },
          ],
        },
        ['source-topic-sgd'],
        ['topic-gradient-descent'],
      ),
    ).toThrow('Only SAME_TOPIC can attach to an existing canonical topic');
  });
});

describe('sourceTopicMatchingPrompt', () => {
  it('describes state-aware matching and excludes historical topic merging', () => {
    const prompt = sourceTopicMatchingPrompt();
    expect(prompt).toContain('considered together');
    expect(prompt).toContain('RELATED_BUT_DISTINCT');
    expect(prompt).toContain('REJECTED is negative memory');
    expect(prompt).toContain('does not repair or merge historical');
  });
});

function sourceTopic(
  id: string,
  spanIndex: number,
  title: string,
  description: string,
  evidence: string[],
) {
  return {
    id,
    spanIndex,
    title,
    description,
    evidence: evidence.map((content) => ({
      content,
      confidence: null,
      spans: [{ content }],
    })),
  };
}

function candidateTopic(
  id: string,
  title: string,
  description: string,
  state: TopicState,
  evidence: string[],
) {
  return {
    id,
    title,
    description,
    state,
    sourceTopics: [
      {
        id: `${id}-source-topic`,
        title,
        description,
        evidence: evidence.map((content) => ({
          content,
          confidence: null,
          spans: [{ content }],
        })),
      },
    ],
  };
}
