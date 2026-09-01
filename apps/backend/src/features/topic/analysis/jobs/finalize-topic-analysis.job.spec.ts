import { Logger } from '@nestjs/common';
import {
  ProcessingState,
  SourceProcessingStageType,
  TopicState,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { createTestDoclingDocument } from '../analysis-document.fixture';
import {
  FinalizeTopicAnalysisJob,
  validateFinalTopicAnalysis,
} from './finalize-topic-analysis.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));
jest.mock('../analysis.queue', () => ({
  AnalysisQueue: class AnalysisQueue {},
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

describe('FinalizeTopicAnalysisJob', () => {
  const sourceId = 'source-id';
  const document = createTestDoclingDocument('Algorithms', [
    {
      label: 'paragraph',
      self_ref: 'ref-1',
      text: 'First fact.',
      prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
    {
      label: 'paragraph',
      self_ref: 'ref-2',
      text: 'Second fact.',
      prov: [{ page_no: 1, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
    {
      label: 'paragraph',
      self_ref: 'ref-3',
      text: 'Administrative note.',
      prov: [{ page_no: 2, bbox: { l: 0, t: 0, r: 1, b: 1 } }],
    },
  ]);
  const sourceTopics = [
    finalSourceTopic({
      id: 'source-topic-0',
      spanIndex: 0,
      startRef: 'ref-1',
      endRef: 'ref-2',
      pageStart: 1,
      pageEnd: 1,
      topic: {
        id: 'topic-1',
        state: TopicState.SUGGESTED,
        moduleId: 'module-id',
        contentRevision: 3,
        summaryRevision: 2,
      },
      evidenceContent: 'First fact.\n\nSecond fact.',
    }),
    finalSourceTopic({
      id: 'source-topic-1',
      spanIndex: 1,
      startRef: 'ref-3',
      endRef: 'ref-3',
      pageStart: 2,
      pageEnd: 2,
      topic: {
        id: 'topic-rejected',
        state: TopicState.REJECTED,
        moduleId: 'module-id',
        contentRevision: 5,
        summaryRevision: null,
      },
      evidenceContent: 'Administrative note.',
    }),
  ];
  const findUnique = jest.fn();
  const readDoclingDocument = jest.fn();
  const transaction = { source: { findUnique } };
  const findProcessingStage = jest.fn();
  const prismaService = {
    sourceProcessingStage: { findUnique: findProcessingStage },
    $transaction: jest.fn(),
  };
  const transition = jest.fn();
  const addSummarizeTopic = jest.fn();
  let job: FinalizeTopicAnalysisJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findUnique.mockResolvedValue({
      document,
      moduleId: 'module-id',
      processingStages: [{ state: ProcessingState.PROCESSING }],
      sourceTopics,
    });
    readDoclingDocument.mockResolvedValue(
      Buffer.from(JSON.stringify(document)),
    );
    findProcessingStage.mockResolvedValue({
      state: ProcessingState.PROCESSING,
    });
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    transition.mockResolvedValue({});
    addSummarizeTopic.mockResolvedValue(undefined);
    job = new FinalizeTopicAnalysisJob(
      prismaService as unknown as PrismaService,
      { readDoclingDocument } as unknown as FileStorageService,
      { transition } as unknown as SourceProcessingStageService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('schedules stale non-rejected summaries and completes after revalidation', async () => {
    await expect(job.process({ sourceId })).resolves.toBeUndefined();

    expect(addSummarizeTopic).toHaveBeenCalledTimes(1);
    expect(addSummarizeTopic).toHaveBeenCalledWith('topic-1', 3);
    expect(findUnique).toHaveBeenCalledTimes(2);
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.COMPLETED,
      { transaction },
    );
  });

  it('fails without completing when evidence is not canonical source content', async () => {
    findUnique.mockResolvedValue({
      document,
      moduleId: 'module-id',
      processingStages: [{ state: ProcessingState.PROCESSING }],
      sourceTopics: [
        {
          ...sourceTopics[0],
          evidence: [
            {
              ...sourceTopics[0].evidence[0],
              spans: [
                {
                  ...sourceTopics[0].evidence[0].spans[0],
                  content: 'Fabricated evidence.',
                },
              ],
            },
          ],
        },
        sourceTopics[1],
      ],
    });

    await expect(job.process({ sourceId })).rejects.toThrow(
      'does not match canonical source content',
    );

    expect(addSummarizeTopic).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.COMPLETED,
      expect.anything(),
    );
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
  });

  it('does not complete if a Topic revision changes after jobs are scheduled', async () => {
    findUnique
      .mockResolvedValueOnce({
        document,
        moduleId: 'module-id',
        processingStages: [{ state: ProcessingState.PROCESSING }],
        sourceTopics,
      })
      .mockResolvedValueOnce({
        document,
        moduleId: 'module-id',
        processingStages: [{ state: ProcessingState.PROCESSING }],
        sourceTopics: [
          {
            ...sourceTopics[0],
            topic: { ...sourceTopics[0].topic, contentRevision: 4 },
          },
          sourceTopics[1],
        ],
      });

    await expect(job.process({ sourceId })).rejects.toThrow(
      'Affected Topic revisions changed before completion',
    );
    expect(transition).toHaveBeenLastCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
  });

  it('skips a deleted source without changing processing state', async () => {
    findUnique.mockResolvedValue(null);

    await expect(job.process({ sourceId })).resolves.toBeUndefined();

    expect(addSummarizeTopic).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it('does not publish summaries or regress an already completed analysis', async () => {
    findUnique.mockResolvedValue({
      document,
      moduleId: 'module-id',
      processingStages: [{ state: ProcessingState.COMPLETED }],
      sourceTopics,
    });
    addSummarizeTopic.mockRejectedValue(new Error('Redis unavailable'));

    await expect(job.process({ sourceId })).resolves.toBeUndefined();

    expect(addSummarizeTopic).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it('preserves completion if summary queuing races with a successful finalizer', async () => {
    addSummarizeTopic.mockRejectedValue(new Error('Redis unavailable'));
    findProcessingStage.mockResolvedValue({
      state: ProcessingState.COMPLETED,
    });

    await expect(job.process({ sourceId })).rejects.toThrow(
      'Redis unavailable',
    );

    expect(findProcessingStage).toHaveBeenCalledWith({
      where: {
        sourceId_stage: {
          sourceId,
          stage: SourceProcessingStageType.TOPIC_ANALYSIS,
        },
      },
      select: { state: true },
    });
    expect(transition).not.toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      expect.anything(),
    );
  });
});

describe('final topic-analysis validation', () => {
  const document = createTestDoclingDocument('Document', [
    { label: 'paragraph', self_ref: 'ref-1', text: 'Grounded.' },
  ]);
  const validTopic = finalSourceTopic({
    id: 'source-topic',
    spanIndex: 0,
    startRef: 'ref-1',
    endRef: 'ref-1',
    pageStart: null,
    pageEnd: null,
    topic: {
      id: 'topic',
      state: TopicState.CONFIRMED,
      moduleId: 'module-id',
      contentRevision: 1,
      summaryRevision: 1,
    },
    evidenceContent: 'Grounded.',
  });

  it('requires final SourceTopics', () => {
    expect(() => validateFinalTopicAnalysis(document, 'module-id', [])).toThrow(
      'contains no SourceTopics',
    );
  });

  it('requires canonicalization', () => {
    expect(() =>
      validateFinalTopicAnalysis(document, 'module-id', [
        { ...validTopic, topic: null },
      ]),
    ).toThrow('has not been canonicalized');
  });

  it('requires contiguous span indexes', () => {
    expect(() =>
      validateFinalTopicAnalysis(document, 'module-id', [
        { ...validTopic, spanIndex: 1 },
      ]),
    ).toThrow('contiguous ordered span indexes');
  });

  it('requires resolvable boundary references', () => {
    expect(() =>
      validateFinalTopicAnalysis(document, 'module-id', [
        { ...validTopic, endRef: 'unknown-ref' },
      ]),
    ).toThrow('references an unknown unit');
  });

  it('requires valid pages', () => {
    expect(() =>
      validateFinalTopicAnalysis(document, 'module-id', [
        { ...validTopic, pageStart: 1, pageEnd: 1 },
      ]),
    ).toThrow('has an invalid page range');
  });

  it('requires valid revision metadata', () => {
    expect(() =>
      validateFinalTopicAnalysis(document, 'module-id', [
        {
          ...validTopic,
          topic: {
            ...validTopic.topic,
            summaryRevision: 2,
          },
        },
      ]),
    ).toThrow('has invalid revision metadata');
  });
});

function finalSourceTopic(input: {
  id: string;
  spanIndex: number;
  startRef: string;
  endRef: string;
  pageStart: number | null;
  pageEnd: number | null;
  topic: {
    id: string;
    state: TopicState;
    moduleId: string;
    contentRevision: number;
    summaryRevision: number | null;
  };
  evidenceContent: string;
}) {
  return {
    id: input.id,
    spanIndex: input.spanIndex,
    title: `Topic ${input.spanIndex}`,
    description: `Description ${input.spanIndex}`,
    detectionConfidence: 0.9,
    canonicalizationConfidence: 0.8,
    startRef: input.startRef,
    endRef: input.endRef,
    pageStart: input.pageStart,
    pageEnd: input.pageEnd,
    topic: input.topic,
    evidence: [
      {
        id: `evidence-${input.spanIndex}`,
        content: `Evidence ${input.spanIndex}`,
        spans: [
          {
            id: `evidence-span-${input.spanIndex}`,
            content: input.evidenceContent,
            startRef: input.startRef,
            endRef: input.endRef,
            pageStart: input.pageStart,
            pageEnd: input.pageEnd,
          },
        ],
      },
    ],
  };
}
