import { Logger } from '@nestjs/common';
import { ParseDocumentJob } from './parse-document.job';
import { FileStorageService } from '../../../../infrastructure/filestorage/filestorage.service';
import { DoclingService } from '../../../../infrastructure/docling/docling.service';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { IngestionQueue } from '../ingestion.queue';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../../infrastructure/database/generated/enums';
import { SourceProcessingStageService } from '../source-processing-stage.service';

jest.mock('../../../../infrastructure/docling/docling.service', () => ({
  DoclingService: class DoclingService {},
}));
jest.mock('../../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ParseDocumentJob', () => {
  const sourceId = 'source-id';
  const sourceDelegate = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const transaction = { source: sourceDelegate };
  const prismaService = {
    source: sourceDelegate,
    $transaction: jest.fn(),
  };
  const fileStorageService = {
    getSourcePath: jest.fn(),
  };
  const doclingService = {
    client: {
      convertFromFile: jest.fn(),
    },
  };
  const ingestionQueue = {
    addBuildRagChunks: jest.fn(),
  };
  const sourceProcessingStageService = {
    transition: jest.fn(),
  };

  let job: ParseDocumentJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue({
      document: null,
      processingStages: [],
    });
    sourceDelegate.update.mockResolvedValue({ id: sourceId });
    sourceProcessingStageService.transition.mockResolvedValue({
      id: 'stage-id',
    });
    prismaService.$transaction.mockImplementation((operation) =>
      operation(transaction),
    );
    fileStorageService.getSourcePath.mockReturnValue('/uploads/source.pdf');
    doclingService.client.convertFromFile.mockResolvedValue({
      document: { json_content: { name: 'converted document' } },
    });
    ingestionQueue.addBuildRagChunks.mockResolvedValue(undefined);

    job = new ParseDocumentJob(
      fileStorageService as unknown as FileStorageService,
      doclingService as unknown as DoclingService,
      prismaService as unknown as PrismaService,
      ingestionQueue as unknown as IngestionQueue,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists the converted document and schedules the next job', async () => {
    await job.process({ sourceId });

    expect(sourceProcessingStageService.transition).toHaveBeenNthCalledWith(
      1,
      sourceId,
      SourceProcessingStageType.CONVERSION,
      ProcessingState.PROCESSING,
    );
    expect(doclingService.client.convertFromFile).toHaveBeenCalledWith(
      '/uploads/source.pdf',
      { to_formats: ['json'], abort_on_error: true },
    );
    expect(sourceDelegate.update).toHaveBeenCalledWith({
      where: { id: sourceId },
      data: { document: { name: 'converted document' } },
    });
    expect(sourceProcessingStageService.transition).toHaveBeenNthCalledWith(
      2,
      sourceId,
      SourceProcessingStageType.CONVERSION,
      ProcessingState.COMPLETED,
      { transaction },
    );
    expect(ingestionQueue.addBuildRagChunks).toHaveBeenCalledWith(sourceId);
  });

  it('resumes at the next job when conversion is already complete', async () => {
    sourceDelegate.findUnique.mockResolvedValue({
      document: { name: 'converted document' },
      processingStages: [{ state: ProcessingState.COMPLETED }],
    });

    await job.process({ sourceId });

    expect(sourceProcessingStageService.transition).not.toHaveBeenCalled();
    expect(doclingService.client.convertFromFile).not.toHaveBeenCalled();
    expect(ingestionQueue.addBuildRagChunks).toHaveBeenCalledWith(sourceId);
  });

  it('records conversion failures and rethrows them for retry handling', async () => {
    const conversionError = new Error('Docling is unavailable');
    doclingService.client.convertFromFile.mockRejectedValue(conversionError);

    await expect(job.process({ sourceId })).rejects.toBe(conversionError);

    expect(sourceProcessingStageService.transition).toHaveBeenLastCalledWith(
      sourceId,
      SourceProcessingStageType.CONVERSION,
      ProcessingState.FAILED,
      { error: conversionError },
    );
    expect(ingestionQueue.addBuildRagChunks).not.toHaveBeenCalled();
  });

  it('does not mark a completed conversion as failed when scheduling fails', async () => {
    const queueError = new Error('Queue is unavailable');
    ingestionQueue.addBuildRagChunks.mockRejectedValue(queueError);

    await expect(job.process({ sourceId })).rejects.toBe(queueError);

    expect(sourceProcessingStageService.transition).toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.CONVERSION,
      ProcessingState.COMPLETED,
      { transaction },
    );
    expect(sourceProcessingStageService.transition).not.toHaveBeenCalledWith(
      sourceId,
      SourceProcessingStageType.CONVERSION,
      ProcessingState.FAILED,
      expect.anything(),
    );
  });

  it('preserves the original failure when failure-state persistence also fails', async () => {
    const conversionError = new Error('Conversion failed');
    doclingService.client.convertFromFile.mockRejectedValue(conversionError);
    sourceProcessingStageService.transition
      .mockResolvedValueOnce({ id: 'stage-id' })
      .mockRejectedValueOnce(new Error('Database failed'));

    await expect(job.process({ sourceId })).rejects.toBe(conversionError);
  });
});
