import { Logger } from '@nestjs/common';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { SourceProcessingStageService } from '../source-processing-stage.service';
import { FinalizeIngestionJob } from './finalize-ingestion.job';

jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('FinalizeIngestionJob', () => {
  const sourceId = 'source-id';
  const sourceDelegate = { findUnique: jest.fn() };
  const queryRaw = jest.fn();
  const transaction = { source: sourceDelegate, $queryRaw: queryRaw };
  const prismaService = { $transaction: jest.fn() };
  const sourceProcessingStageService = { transition: jest.fn() };

  let job: FinalizeIngestionJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue({
      document: { schema_name: 'DoclingDocument' },
    });
    queryRaw.mockResolvedValue([]);
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });

    job = new FinalizeIngestionJob(
      prismaService as unknown as PrismaService,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('completes RAG indexing when the source document exists and no chunk is missing an embedding', async () => {
    await job.process({ sourceId });

    expect(sourceDelegate.findUnique).toHaveBeenCalledWith({
      where: { id: sourceId },
      select: { document: true },
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
  });

  it('rejects finalization when document conversion has no result', async () => {
    sourceDelegate.findUnique.mockResolvedValue({ document: null });

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
  });

  it('skips a source that was deleted before finalization', async () => {
    sourceDelegate.findUnique.mockResolvedValue(null);

    await job.process({ sourceId });

    expect(queryRaw).not.toHaveBeenCalled();
    expect(sourceProcessingStageService.transition).not.toHaveBeenCalled();
  });
});
