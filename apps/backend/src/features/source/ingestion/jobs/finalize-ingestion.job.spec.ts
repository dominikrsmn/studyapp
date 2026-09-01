import { Logger } from '@nestjs/common';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { AnalysisQueue } from '../../../topic/analysis/analysis.queue';
import { SourceProcessingStageService } from '../source-processing-stage.service';
import { FinalizeIngestionJob } from './finalize-ingestion.job';

jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../../topic/analysis/analysis.queue', () => ({
  AnalysisQueue: class AnalysisQueue {},
}));

describe('FinalizeIngestionJob', () => {
  const sourceId = 'source-id';
  const sourceDelegate = { findUnique: jest.fn() };
  const queryRaw = jest.fn();
  const transaction = { $queryRaw: queryRaw };
  const prismaService = {
    source: sourceDelegate,
    $transaction: jest.fn(),
  };
  const fileStorageService = { hasDoclingDocument: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };
  const analysisQueue = { addPrepareTopicAnalysis: jest.fn() };

  let job: FinalizeIngestionJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue({ id: sourceId });
    fileStorageService.hasDoclingDocument.mockResolvedValue(true);
    queryRaw.mockResolvedValue([]);
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });
    analysisQueue.addPrepareTopicAnalysis.mockResolvedValue(undefined);

    job = new FinalizeIngestionJob(
      prismaService as unknown as PrismaService,
      fileStorageService as unknown as FileStorageService,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
      analysisQueue as unknown as AnalysisQueue,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('completes RAG indexing when the source document exists and no chunk is missing an embedding', async () => {
    await job.process({ sourceId });

    expect(sourceDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: sourceId },
      select: { id: true },
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);

    const sql = queryRaw.mock.calls[0][0].join('');
    expect(sql).toContain('chunk."sourceId" = ');
    expect(sql).toContain('chunk."embedding" IS NULL');
    expect(sql).toContain('LIMIT 1');
    expect(sql).not.toContain('vector_dims');
    expect(sql).not.toContain('ORDER BY');
    expect(sql).not.toContain('FOR UPDATE');
    expect(queryRaw.mock.calls[0].slice(1)).toEqual([sourceId]);

    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.COMPLETED,
      { transaction },
    );
    expect(analysisQueue.addPrepareTopicAnalysis).toHaveBeenCalledWith(
      sourceId,
    );
  });

  it('rejects finalization when a persisted chunk is missing its embedding', async () => {
    queryRaw.mockResolvedValue([{ id: 'chunk-3' }]);

    await expect(job.process({ sourceId })).rejects.toThrow(
      'Source chunk "chunk-3" has no embedding',
    );

    expect(sourceProcessingStageService.transition).not.toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.COMPLETED,
      expect.anything(),
    );
    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.FAILED,
      {
        error: expect.objectContaining({
          message: 'Source chunk "chunk-3" has no embedding',
        }),
      },
    );
    expect(analysisQueue.addPrepareTopicAnalysis).not.toHaveBeenCalled();
  });

  it('rejects finalization when document conversion has no result', async () => {
    fileStorageService.hasDoclingDocument.mockResolvedValue(false);

    await expect(job.process({ sourceId })).rejects.toThrow(
      'Source has no converted Docling document',
    );

    expect(queryRaw).not.toHaveBeenCalled();
    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.RAG_INDEXING,
      ProcessingState.FAILED,
      {
        error: expect.objectContaining({
          message: 'Source has no converted Docling document',
        }),
      },
    );
    expect(analysisQueue.addPrepareTopicAnalysis).not.toHaveBeenCalled();
  });

  it('skips a source that was deleted before finalization', async () => {
    sourceDelegate.findUnique.mockResolvedValue(null);

    await job.process({ sourceId });

    expect(queryRaw).not.toHaveBeenCalled();
    expect(sourceProcessingStageService.transition).not.toHaveBeenCalled();
    expect(analysisQueue.addPrepareTopicAnalysis).not.toHaveBeenCalled();
  });
});
