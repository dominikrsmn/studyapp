import { Logger } from '@nestjs/common';
import { ZodError } from 'zod';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { SourceProcessingStageService } from '../../../source/ingestion/source-processing-stage.service';
import { analysisConfig } from '../analysis.config';
import { createTestDoclingDocument } from '../analysis-document.fixture';
import { AnalysisQueue } from '../analysis.queue';
import type { AnalysisUnit } from '../analysis.types';
import {
  createBoundaryAnalysisUnits,
  deriveOrderedDocumentUnitRefs,
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
  const document = createTestDoclingDocument('Test document', [
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
  ]);
  const sourceDelegate = { findUnique: jest.fn() };
  const prismaService = { source: sourceDelegate };
  const fileStorageService = { readDoclingDocument: jest.fn() };
  const analysisQueue = { addBoundaryDetectionFlow: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };
  const config = analysisConfig();

  let job: PrepareTopicAnalysisJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue({ id: sourceId });
    fileStorageService.readDoclingDocument.mockResolvedValue(
      Buffer.from(JSON.stringify(document)),
    );
    analysisQueue.addBoundaryDetectionFlow.mockResolvedValue(undefined);
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });

    job = new PrepareTopicAnalysisJob(
      prismaService as unknown as PrismaService,
      fileStorageService as unknown as FileStorageService,
      analysisQueue as unknown as AnalysisQueue,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
      config,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates analysis units and fans them out through the boundary flow', async () => {
    await job.process({ sourceId });

    expect(sourceDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: sourceId },
      select: { id: true },
    });
    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.PROCESSING,
    );
    expect(analysisQueue.addBoundaryDetectionFlow).toHaveBeenCalledWith(
      sourceId,
      [
        {
          index: 0,
          documentUnitRefs: [
            '#/texts/2',
            '#/texts/0',
            '#/tables/0',
            '#/pictures/0',
            '#/texts/1',
          ],
        },
      ],
    );
  });

  it('skips deleted sources without changing analysis state', async () => {
    sourceDelegate.findUnique.mockResolvedValue(null);

    await job.process({ sourceId });

    expect(sourceProcessingStageService.transition).not.toHaveBeenCalled();
    expect(analysisQueue.addBoundaryDetectionFlow).not.toHaveBeenCalled();
  });

  it('records preparation failures and rethrows for retry handling', async () => {
    fileStorageService.readDoclingDocument.mockResolvedValue(null);

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

  it('rejects a malformed stored document before creating analysis units', async () => {
    fileStorageService.readDoclingDocument.mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          schema_name: 'DoclingDocument',
          name: 'Malformed document',
          body: {
            self_ref: '#/body',
            children: [{ $ref: '#/texts/0' }],
          },
          texts: [{ label: 42, self_ref: 'ref-1', text: '', orig: '' }],
        }),
      ),
    );

    await expect(job.process({ sourceId })).rejects.toBeInstanceOf(ZodError);

    expect(sourceProcessingStageService.transition).toHaveBeenLastCalledWith(
      sourceId,
      SourceProcessingStageType.TOPIC_ANALYSIS,
      ProcessingState.FAILED,
      { error: expect.any(ZodError) },
    );
    expect(analysisQueue.addBoundaryDetectionFlow).not.toHaveBeenCalled();
  });

  it('constructs indexed overlapping analysis units across the document', async () => {
    fileStorageService.readDoclingDocument.mockResolvedValue(
      Buffer.from(
        JSON.stringify(
          createTestDoclingDocument(
            'Long document',
            Array.from({ length: 170 }, (_, index) => ({
              label: 'paragraph',
              self_ref: `ref-${index + 1}`,
            })),
          ),
        ),
      ),
    );

    await job.process({ sourceId });

    const analysisUnits = analysisQueue.addBoundaryDetectionFlow.mock
      .calls[0][1] as AnalysisUnit[];
    expect(analysisUnits).toHaveLength(3);
    expect(analysisUnits.map(({ index }) => index)).toEqual([0, 1, 2]);
    expect([
      analysisUnits[0].documentUnitRefs[0],
      analysisUnits[0].documentUnitRefs[69],
    ]).toEqual(['ref-1', 'ref-70']);
    expect([
      analysisUnits[1].documentUnitRefs[0],
      analysisUnits[1].documentUnitRefs[69],
    ]).toEqual(['ref-51', 'ref-120']);
    expect([
      analysisUnits[2].documentUnitRefs[0],
      analysisUnits[2].documentUnitRefs[69],
    ]).toEqual(['ref-101', 'ref-170']);
  });
});

describe('boundary analysis unit creation', () => {
  it('follows nested main text in reading order without page boundaries', () => {
    const document = createTestDoclingDocument('Paged document', [
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
    ]);

    expect(deriveOrderedDocumentUnitRefs(document)).toEqual([
      '#/texts/0',
      '#/texts/1',
      '#/texts/2',
      '#/texts/3',
    ]);
  });

  it('creates one descriptor per detection job without document content', () => {
    const document = createTestDoclingDocument(
      'Document',
      Array.from({ length: 6 }, (_, index) => ({
        label: 'paragraph',
        self_ref: `ref-${index + 1}`,
      })),
    );

    expect(createBoundaryAnalysisUnits(document, 4, 1)).toEqual([
      {
        index: 0,
        documentUnitRefs: ['ref-1', 'ref-2', 'ref-3', 'ref-4'],
      },
      {
        index: 1,
        documentUnitRefs: ['ref-4', 'ref-5', 'ref-6'],
      },
    ]);
  });
});
