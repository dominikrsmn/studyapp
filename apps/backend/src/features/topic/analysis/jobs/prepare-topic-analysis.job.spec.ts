import { Logger } from '@nestjs/common';
import type { DoclingDocument } from 'docling-sdk';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { AnalysisQueue } from '../analysis.queue';
import {
  deriveOrderedAnalysisUnitRefs,
  PrepareTopicAnalysisJob,
} from './prepare-topic-analysis.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../source/ingestion/source-processing-stage.service', () => ({
  SourceProcessingStageService: class SourceProcessingStageService {},
}));
jest.mock('../analysis.queue', () => ({
  AnalysisQueue: class AnalysisQueue {},
}));

describe('PrepareTopicAnalysisJob', () => {
  const sourceId = 'source-id';
  const document = {
    schema_name: 'DoclingDocument',
    name: 'Test document',
    main_text: [
      {
        label: 'section_header',
        self_ref: '#/texts/2',
        children: [
          { label: 'paragraph', self_ref: '#/texts/0' },
          { label: 'table', self_ref: '#/tables/0' },
        ],
      },
      {
        label: 'picture',
        self_ref: '#/pictures/0',
        children: [{ label: 'paragraph', self_ref: '#/texts/1' }],
      },
    ],
  } satisfies DoclingDocument;
  const sourceDelegate = { findUnique: jest.fn() };
  const prismaService = { source: sourceDelegate };
  const analysisQueue = { addBoundaryDetectionFlow: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };
  const config = analysisConfig();

  let job: PrepareTopicAnalysisJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue({ document });
    analysisQueue.addBoundaryDetectionFlow.mockResolvedValue(undefined);
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });

    job = new PrepareTopicAnalysisJob(
      prismaService as unknown as PrismaService,
      analysisQueue as unknown as AnalysisQueue,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
      config,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads the canonical document and enqueues its ordered unit windows', async () => {
    await job.process({ sourceId });

    expect(sourceDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: sourceId },
      select: { document: true },
    });
    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.PROCESSING,
    );
    expect(analysisQueue.addBoundaryDetectionFlow).toHaveBeenCalledWith(
      sourceId,
      [['#/texts/2', '#/texts/0', '#/tables/0', '#/pictures/0', '#/texts/1']],
    );
  });

  it('skips deleted sources without changing analysis state', async () => {
    sourceDelegate.findUnique.mockResolvedValue(null);

    await job.process({ sourceId });

    expect(sourceProcessingStageService.transition).not.toHaveBeenCalled();
    expect(analysisQueue.addBoundaryDetectionFlow).not.toHaveBeenCalled();
  });

  it('records preparation failures and rethrows for retry handling', async () => {
    sourceDelegate.findUnique.mockResolvedValue({ document: null });

    await expect(job.process({ sourceId })).rejects.toThrow(
      'Source has no converted Docling document',
    );

    expect(sourceProcessingStageService.transition).toHaveBeenLastCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(Error) },
    );
    expect(analysisQueue.addBoundaryDetectionFlow).not.toHaveBeenCalled();
  });

  it('constructs overlapping windows across the full document stream', async () => {
    sourceDelegate.findUnique.mockResolvedValue({
      document: {
        name: 'Long document',
        main_text: Array.from({ length: 170 }, (_, index) => ({
          label: 'paragraph',
          self_ref: `ref-${index + 1}`,
        })),
      } satisfies DoclingDocument,
    });

    await job.process({ sourceId });

    const windows = analysisQueue.addBoundaryDetectionFlow.mock.calls[0][1];
    expect(windows).toHaveLength(3);
    expect([windows[0][0], windows[0][69]]).toEqual(['ref-1', 'ref-70']);
    expect([windows[1][0], windows[1][69]]).toEqual(['ref-51', 'ref-120']);
    expect([windows[2][0], windows[2][69]]).toEqual(['ref-101', 'ref-170']);
  });
});

describe('deriveOrderedAnalysisUnitRefs', () => {
  it('follows nested main text in reading order without page boundaries', () => {
    const document = {
      name: 'Paged document',
      main_text: [
        {
          label: 'section_header',
          self_ref: '#/texts/0',
          children: [
            {
              label: 'paragraph',
              self_ref: '#/texts/1',
              prov: [
                {
                  page_no: 1,
                  bbox: { l: 0, t: 0, r: 1, b: 1 },
                },
              ],
            },
            {
              label: 'paragraph',
              self_ref: '#/texts/2',
              prov: [
                {
                  page_no: 2,
                  bbox: { l: 0, t: 0, r: 1, b: 1 },
                },
              ],
            },
          ],
        },
        { label: 'paragraph', self_ref: '#/texts/3' },
      ],
    } satisfies DoclingDocument;

    expect(deriveOrderedAnalysisUnitRefs(document)).toEqual([
      '#/texts/0',
      '#/texts/1',
      '#/texts/2',
      '#/texts/3',
    ]);
  });
});
