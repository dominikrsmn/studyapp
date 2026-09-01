import { Logger } from '@nestjs/common';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { createTestDoclingDocument } from '../analysis-document.fixture';
import { parseAnalysisDocument } from '../analysis-document.schema';
import { AnalysisQueue } from '../analysis.queue';
import { ExtractSourceTopics } from '../analysis.types';
import {
  ExtractSourceTopicsJob,
  resolveTopicSpans,
  sourceTopicExtractionPrompt,
} from './extract-source-topics.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class OpenAiService {},
}));
jest.mock('../../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));
jest.mock('@docling/docling-core', () => ({
  iterateDocumentItems: function* (document: {
    body: { children?: Array<{ $ref: string }> };
    [collection: string]: unknown;
  }) {
    const resolve = (ref: string) => {
      const [, collection, rawIndex] = ref.split('/');
      return (document[collection] as Array<Record<string, unknown>>)[
        Number(rawIndex)
      ];
    };
    const visit = function* (
      item: Record<string, unknown>,
    ): Generator<[Record<string, unknown>]> {
      yield [item];
      for (const child of (item.children ?? []) as Array<{ $ref: string }>) {
        yield* visit(resolve(child.$ref));
      }
    };

    for (const child of document.body.children ?? []) {
      yield* visit(resolve(child.$ref));
    }
  },
  isDocling: {
    DocItem: (item: Record<string, unknown>) => 'label' in item,
    SectionHeaderItem: (item: Record<string, unknown>) =>
      item.label === 'section_header',
    TableItem: (item: Record<string, unknown>) => item.label === 'table',
    PictureItem: (item: Record<string, unknown>) => item.label === 'picture',
    PictureDescription: (annotation: Record<string, unknown>) =>
      annotation.kind === 'description',
  },
}));

describe('ExtractSourceTopicsJob', () => {
  const sourceId = 'source-id';
  const document = createTestDoclingDocument('Graph Algorithms', [
    {
      label: 'section_header',
      self_ref: 'r0',
      text: 'Shortest Paths',
      level: 1,
      prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
    {
      label: 'paragraph',
      self_ref: 'r1',
      text: 'Dijkstra selects the unsettled vertex with minimum distance.',
      prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
    {
      label: 'paragraph',
      self_ref: 'r2',
      text: 'Relaxation improves a tentative distance through an edge.',
      prov: [{ page_no: 2, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
    {
      label: 'section_header',
      self_ref: 'r3',
      text: 'Negative Weights',
      level: 1,
      prov: [{ page_no: 3, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
    {
      label: 'paragraph',
      self_ref: 'r4',
      text: 'Bellman-Ford repeatedly relaxes every edge.',
      prov: [{ page_no: 3, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
  ]);
  const data: ExtractSourceTopics = {
    sourceId,
    spans: [
      { spanIndex: 0, startRef: 'r0', endRef: 'r2' },
      { spanIndex: 1, startRef: 'r3', endRef: 'r4' },
    ],
  };
  const findUnique = jest.fn();
  const readDoclingDocument = jest.fn();
  const parse = jest.fn();
  const transition = jest.fn();
  const addMatchSourceTopics = jest.fn();
  const sourceTopic = {
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  };
  const topicEvidence = {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  };
  const topicEvidenceSpan = {
    createMany: jest.fn(),
  };
  const transaction = { sourceTopic, topicEvidence, topicEvidenceSpan };
  const prismaService = {
    source: { findUnique },
    $transaction: jest.fn(),
  };
  const config = analysisConfig();
  let job: ExtractSourceTopicsJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findUnique.mockResolvedValue({ id: sourceId });
    readDoclingDocument.mockResolvedValue(
      Buffer.from(JSON.stringify(document)),
    );
    parse.mockResolvedValue({
      output_parsed: {
        topics: [
          {
            spanIndex: 0,
            title: "Dijkstra's Algorithm",
            description:
              'Single-source shortest paths with non-negative edge weights, including greedy selection and relaxation.',
            detectionConfidence: 0.96,
            evidence: [
              {
                description:
                  'The algorithm greedily selects a minimum-distance unsettled vertex and relaxes outgoing edges.',
                spans: [{ startRef: 'r1', endRef: 'r2' }],
              },
            ],
          },
          {
            spanIndex: 1,
            title: 'Bellman–Ford Algorithm',
            description:
              'Single-source shortest paths in graphs that may contain negative-weight edges.',
            detectionConfidence: 0.93,
            evidence: [
              {
                description:
                  'Bellman–Ford computes paths through repeated edge relaxation.',
                spans: [{ startRef: 'r4', endRef: 'r4' }],
              },
            ],
          },
        ],
      },
    });
    sourceTopic.upsert.mockImplementation(({ create }) =>
      Promise.resolve({ id: `source-topic-${create.spanIndex}` }),
    );
    sourceTopic.deleteMany.mockResolvedValue({ count: 0 });
    topicEvidence.deleteMany.mockResolvedValue({ count: 0 });
    topicEvidence.createMany.mockResolvedValue({ count: 2 });
    topicEvidenceSpan.createMany.mockResolvedValue({ count: 2 });
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    transition.mockResolvedValue({ id: 'stage-id' });
    addMatchSourceTopics.mockResolvedValue(undefined);

    job = new ExtractSourceTopicsJob(
      prismaService as unknown as PrismaService,
      { readDoclingDocument } as unknown as FileStorageService,
      { client: { responses: { parse } } } as unknown as OpenAiService,
      { transition } as unknown as SourceProcessingStageService,
      { addMatchSourceTopics } as unknown as AnalysisQueue,
      config,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('extracts, deterministically grounds, persists, and chains final spans', async () => {
    await expect(job.process(data)).resolves.toBeUndefined();

    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: config.sourceTopicExtraction.model,
      reasoning: { effort: config.sourceTopicExtraction.reasoningEffort },
      text: {
        format: {
          type: 'json_schema',
          name: 'extracted_source_topics',
          strict: true,
        },
      },
    });
    expect(request.input[1].content).toContain('Dijkstra selects');
    expect(request.input[1].content).toContain('"spanIndex": 1');

    expect(sourceTopic.upsert).toHaveBeenNthCalledWith(1, {
      where: { sourceId_spanIndex: { sourceId, spanIndex: 0 } },
      create: {
        sourceId,
        spanIndex: 0,
        title: "Dijkstra's Algorithm",
        description:
          'Single-source shortest paths with non-negative edge weights, including greedy selection and relaxation.',
        detectionConfidence: 0.96,
        startRef: 'r0',
        endRef: 'r2',
        pageStart: 1,
        pageEnd: 2,
      },
      update: expect.objectContaining({
        title: "Dijkstra's Algorithm",
        topicId: null,
        canonicalizationConfidence: null,
        startRef: 'r0',
        endRef: 'r2',
        pageStart: 1,
        pageEnd: 2,
      }),
      select: { id: true },
    });
    expect(topicEvidence.deleteMany).toHaveBeenCalledTimes(1);
    expect(topicEvidence.deleteMany).toHaveBeenCalledWith({
      where: {
        sourceTopicId: { in: ['source-topic-0', 'source-topic-1'] },
      },
    });
    const evidenceRows = topicEvidence.createMany.mock.calls[0][0].data;
    expect(evidenceRows).toEqual([
      {
        id: expect.any(String),
        sourceTopicId: 'source-topic-0',
        content:
          'The algorithm greedily selects a minimum-distance unsettled vertex and relaxes outgoing edges.',
      },
      {
        id: expect.any(String),
        sourceTopicId: 'source-topic-1',
        content:
          'Bellman–Ford computes paths through repeated edge relaxation.',
      },
    ]);
    expect(topicEvidenceSpan.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: expect.any(String),
          topicEvidenceId: evidenceRows[0].id,
          content:
            'Dijkstra selects the unsettled vertex with minimum distance.\n\nRelaxation improves a tentative distance through an edge.',
          startRef: 'r1',
          endRef: 'r2',
          pageStart: 1,
          pageEnd: 2,
        },
        {
          id: expect.any(String),
          topicEvidenceId: evidenceRows[1].id,
          content: 'Bellman-Ford repeatedly relaxes every edge.',
          startRef: 'r4',
          endRef: 'r4',
          pageStart: 3,
          pageEnd: 3,
        },
      ],
    });
    expect(sourceTopic.deleteMany).toHaveBeenCalledWith({
      where: { sourceId, spanIndex: { gte: 2 } },
    });
    expect(addMatchSourceTopics).toHaveBeenCalledWith(sourceId);
    expect(topicEvidence.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      topicEvidence.createMany.mock.invocationCallOrder[0],
    );
    expect(topicEvidence.createMany.mock.invocationCallOrder[0]).toBeLessThan(
      topicEvidenceSpan.createMany.mock.invocationCallOrder[0],
    );
    expect(
      topicEvidenceSpan.createMany.mock.invocationCallOrder[0],
    ).toBeLessThan(addMatchSourceTopics.mock.invocationCallOrder[0]);
  });

  it('rejects evidence refs outside their final topic span', async () => {
    const output = await parse();
    output.output_parsed.topics[0].evidence[0].spans = [
      { startRef: 'r1', endRef: 'r3' },
    ];
    parse.mockResolvedValue(output);

    await expect(job.process(data)).rejects.toThrow('Invalid option');
    expect(prismaService.$transaction).not.toHaveBeenCalled();
    expect(addMatchSourceTopics).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
  });

  it('validates complete contiguous segmentation before calling the model', async () => {
    await expect(
      job.process({
        sourceId,
        spans: [{ spanIndex: 0, startRef: 'r1', endRef: 'r4' }],
      }),
    ).rejects.toThrow('contiguous and in document order');

    expect(parse).not.toHaveBeenCalled();
    expect(prismaService.$transaction).not.toHaveBeenCalled();
  });

  it('does not enqueue matching when persistence fails', async () => {
    const persistenceError = new Error('database unavailable');
    prismaService.$transaction.mockRejectedValue(persistenceError);

    await expect(job.process(data)).rejects.toBe(persistenceError);

    expect(addMatchSourceTopics).not.toHaveBeenCalled();
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: persistenceError },
    );
  });

  it('skips deleted sources without calling the model or changing state', async () => {
    findUnique.mockResolvedValue(null);

    await expect(job.process(data)).resolves.toBeUndefined();

    expect(parse).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
    expect(addMatchSourceTopics).not.toHaveBeenCalled();
  });
});

describe('source topic extraction helpers', () => {
  it('derives nullable page bounds from canonical units', () => {
    expect(
      resolveTopicSpans(
        parseAnalysisDocument({
          ...createTestDoclingDocument('Nested source', [
            {
              label: 'section_header',
              self_ref: 'heading',
              text: 'Heading',
              children: [
                {
                  label: 'paragraph',
                  self_ref: 'body',
                  text: 'Body',
                  prov: [
                    {
                      page_no: 4,
                      bbox: { l: 0, t: 0, r: 1, b: 1 },
                    },
                  ],
                },
              ],
            },
          ]),
        }),
        [{ spanIndex: 0, startRef: 'heading', endRef: 'body' }],
      ),
    ).toMatchObject([{ pageStart: 4, pageEnd: 4 }]);
  });

  it('specifies canonical titles, scope descriptions, and ref-only evidence', () => {
    const prompt = sourceTopicExtractionPrompt();

    expect(prompt).toContain('canonicalizable noun phrase or named concept');
    expect(prompt).toContain(
      "Define the topic's scope rather than summarizing",
    );
    expect(prompt).toContain('Do not quote or reproduce source excerpts');
    expect(prompt).toContain('A source heading is evidence');
  });
});
