import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { OpenAiService } from '../../../../infrastructure/open-ai/open-ai.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { parseAnalysisDocument } from '../analysis-document.schema';
import { MergeBoundaries } from '../analysis.types';
import {
  boundaryMergingPrompt,
  buildBoundaryCandidates,
  createTopicSpans,
  MergeBoundariesJob,
} from './merge-boundaries.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../../infrastructure/open-ai/open-ai.service', () => ({
  OpenAiService: class OpenAiService {},
}));
jest.mock('../../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));

describe('MergeBoundariesJob', () => {
  const sourceId = 'source-id';
  const document = parseAnalysisDocument({
    name: 'Algorithms',
    main_text: Array.from({ length: 10 }, (_, index) => ({
      label: index === 5 ? 'section_header' : 'paragraph',
      self_ref: `r${index}`,
      text: index < 5 ? `Dijkstra ${index}` : `Bellman-Ford ${index}`,
      ...(index === 5 ? { level: 2 } : {}),
    })),
  });
  const findUnique = jest.fn();
  const getChildrenValues = jest.fn();
  const parse = jest.fn();
  const transition = jest.fn();
  const config = {
    ...analysisConfig(),
    boundaryDetection: {
      ...analysisConfig().boundaryDetection,
      windowSize: 6,
      windowOverlap: 2,
    },
  };

  let mergeJob: MergeBoundariesJob;
  let bullJob: Job<MergeBoundaries>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    findUnique.mockResolvedValue({ document });
    getChildrenValues.mockResolvedValue({
      'bull:topic-analysis:detect-boundaries/source-id/0': {
        boundaries: [{ afterRef: 'r4', confidence: 0.8 }],
      },
      'bull:topic-analysis:detect-boundaries/source-id/1': {
        boundaries: [{ afterRef: 'r4', confidence: 0.9 }],
      },
    });
    parse.mockResolvedValue({
      output_parsed: {
        adjudications: [
          {
            afterRef: 'r4',
            isBoundary: true,
            structuralEvidence: 0.8,
            semanticDiscontinuity: 0.9,
            decisionConfidence: 0.95,
          },
        ],
      },
    });
    transition.mockResolvedValue({ id: 'stage-id' });

    mergeJob = new MergeBoundariesJob(
      { source: { findUnique } } as unknown as PrismaService,
      { client: { responses: { parse } } } as unknown as OpenAiService,
      { transition } as unknown as SourceProcessingStageService,
      config,
    );
    bullJob = {
      data: { sourceId },
      getChildrenValues,
    } as unknown as Job<MergeBoundaries>;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adjudicates agreeing child proposals and creates contiguous spans', async () => {
    await expect(mergeJob.process(bullJob)).resolves.toEqual({
      boundaries: [
        {
          afterRef: 'r4',
          confidence: 0.8225,
          evidence: {
            unitAgreement: 1,
            structuralEvidence: 0.8,
            semanticDiscontinuity: 0.9,
            modelDecision: 0.95,
            windowEdgeDistance: 0,
            childConfidence: 0.85,
          },
        },
      ],
      spans: [
        { index: 0, startRef: 'r0', endRef: 'r4' },
        { index: 1, startRef: 'r5', endRef: 'r9' },
      ],
    });

    expect(getChildrenValues).toHaveBeenCalledTimes(1);
    const request = parse.mock.calls[0][0];
    expect(request).toMatchObject({
      model: config.boundaryMerging.model,
      reasoning: { effort: config.boundaryMerging.reasoningEffort },
      text: {
        format: {
          type: 'json_schema',
          name: 'merged_topic_boundaries',
          strict: true,
        },
      },
    });
    expect(request.input[1].content).toContain('"voteCount": 2');
    expect(request.input[1].content).toContain(
      '"requiresShortSpanReview": true',
    );
  });

  it('accepts a short topic when the model independently keeps it', async () => {
    const result = await mergeJob.process(bullJob);

    expect(result.boundaries).toHaveLength(1);
    expect(
      result.spans.map(({ startRef, endRef }) => [startRef, endRef]),
    ).toEqual([
      ['r0', 'r4'],
      ['r5', 'r9'],
    ]);
  });

  it('does not call the model when no child proposed a boundary', async () => {
    getChildrenValues.mockResolvedValue({
      'bull:topic-analysis:detect-boundaries/source-id/0': { boundaries: [] },
      'bull:topic-analysis:detect-boundaries/source-id/1': { boundaries: [] },
    });

    await expect(mergeJob.process(bullJob)).resolves.toEqual({
      boundaries: [],
      spans: [{ index: 0, startRef: 'r0', endRef: 'r9' }],
    });
    expect(parse).not.toHaveBeenCalled();
  });

  it('uses the model decision rather than a mechanical confidence threshold', async () => {
    parse.mockResolvedValue({
      output_parsed: {
        adjudications: [
          {
            afterRef: 'r4',
            isBoundary: false,
            structuralEvidence: 1,
            semanticDiscontinuity: 1,
            decisionConfidence: 0.51,
          },
        ],
      },
    });

    await expect(mergeJob.process(bullJob)).resolves.toEqual({
      boundaries: [],
      spans: [{ index: 0, startRef: 'r0', endRef: 'r9' }],
    });
  });

  it('records a stage failure for a child result outside its window', async () => {
    getChildrenValues.mockResolvedValue({
      'bull:topic-analysis:detect-boundaries/source-id/0': {
        boundaries: [{ afterRef: 'r8', confidence: 0.9 }],
      },
      'bull:topic-analysis:detect-boundaries/source-id/1': { boundaries: [] },
    });

    await expect(mergeJob.process(bullJob)).rejects.toThrow(
      'outside its analysis unit',
    );
    expect(transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
  });
});

describe('boundary merging evidence', () => {
  const document = parseAnalysisDocument({
    name: 'Agreement',
    main_text: Array.from({ length: 6 }, (_, index) => ({
      label: 'paragraph',
      self_ref: `r${index}`,
      text: `Unit ${index}`,
    })),
  });
  const refs = Array.from({ length: 6 }, (_, index) => `r${index}`);
  const first = {
    analysisUnit: { documentUnitRefs: ['r0', 'r1', 'r2', 'r3'] },
    result: { boundaries: [{ afterRef: 'r2', confidence: 0.8 }] },
  };
  const second = {
    analysisUnit: { documentUnitRefs: ['r2', 'r3', 'r4', 'r5'] },
    result: { boundaries: [{ afterRef: 'r2', confidence: 0.8 }] },
  };

  it('raises agreement when a second analysis unit independently concurs', () => {
    const singleVote = buildBoundaryCandidates(document, refs, [first], 2, 8);
    const agreeingVotes = buildBoundaryCandidates(
      document,
      refs,
      [first, second],
      2,
      8,
    );

    expect(agreeingVotes[0].unitAgreement).toBeGreaterThan(
      singleVote[0].unitAgreement,
    );
  });

  it('creates spans using actual reading-order successors, not ref arithmetic', () => {
    expect(createTopicSpans(['alpha', 'zeta', 'omega'], ['alpha'])).toEqual([
      { index: 0, startRef: 'alpha', endRef: 'alpha' },
      { index: 1, startRef: 'zeta', endRef: 'omega' },
    ]);
  });

  it('describes short spans as review triggers and permits coherent long spans', () => {
    const prompt = boundaryMergingPrompt();

    expect(prompt).toContain(
      'Never reject a boundary merely because a span is short',
    );
    expect(prompt).toContain('a long coherent topic is entirely acceptable');
    expect(prompt).toContain('isBoundary is the final model decision');
  });
});
