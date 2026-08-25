import { Logger } from '@nestjs/common';
import { ParseDocumentJob } from './parse-document.job';
import { FileStorageService } from '../../../infrastructure/filestorage/filestorage.service';
import { DoclingService } from '../../../infrastructure/docling/docling.service';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { IngestionQueue } from '../ingestion.queue';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../../infrastructure/database/generated/enums';

jest.mock('../../../infrastructure/docling/docling.service', () => ({
  DoclingService: class DoclingService {},
}));
jest.mock('../../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ParseDocumentJob', () => {
  const sourceId = 'source-id';
  const sourceDelegate = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const processingStageDelegate = {
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prismaService = {
    source: sourceDelegate,
    sourceProcessingStage: processingStageDelegate,
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

  let job: ParseDocumentJob;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    sourceDelegate.findUnique.mockResolvedValue({
      document: null,
      processingStages: [],
    });
    sourceDelegate.update.mockResolvedValue({ id: sourceId });
    processingStageDelegate.upsert.mockResolvedValue({ id: 'stage-id' });
    processingStageDelegate.update.mockResolvedValue({ id: 'stage-id' });
    processingStageDelegate.updateMany.mockResolvedValue({ count: 1 });
    prismaService.$transaction.mockImplementation((operations) =>
      Promise.all(operations),
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
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists the converted document and schedules the next job', async () => {
    await job.process({ sourceId });

    expect(processingStageDelegate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceId,
          state: ProcessingState.PROCESSING,
        }),
        update: expect.objectContaining({
          state: ProcessingState.PROCESSING,
          completedAt: null,
          errorMessage: null,
        }),
      }),
    );
    expect(doclingService.client.convertFromFile).toHaveBeenCalledWith(
      '/uploads/source.pdf',
      { to_formats: ['json'], abort_on_error: true },
    );
    expect(sourceDelegate.update).toHaveBeenCalledWith({
      where: { id: sourceId },
      data: { document: JSON.stringify({ name: 'converted document' }) },
    });
    expect(processingStageDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: ProcessingState.COMPLETED,
          errorMessage: null,
        }),
      }),
    );
    expect(ingestionQueue.addBuildRagChunks).toHaveBeenCalledWith(sourceId);
  });

  it('resumes at the next job when conversion is already complete', async () => {
    sourceDelegate.findUnique.mockResolvedValue({
      document: { name: 'converted document' },
      processingStages: [{ state: ProcessingState.COMPLETED }],
    });

    await job.process({ sourceId });

    expect(processingStageDelegate.upsert).not.toHaveBeenCalled();
    expect(doclingService.client.convertFromFile).not.toHaveBeenCalled();
    expect(ingestionQueue.addBuildRagChunks).toHaveBeenCalledWith(sourceId);
  });

  it('records conversion failures and rethrows them for retry handling', async () => {
    const conversionError = new Error('Docling is unavailable');
    doclingService.client.convertFromFile.mockRejectedValue(conversionError);

    await expect(job.process({ sourceId })).rejects.toBe(conversionError);

    expect(processingStageDelegate.updateMany).toHaveBeenCalledWith({
      where: {
        sourceId,
        stage: SourceProcessingStageType.CONVERSION,
        state: ProcessingState.PROCESSING,
      },
      data: {
        state: ProcessingState.FAILED,
        completedAt: expect.any(Date),
        errorMessage: conversionError.message,
      },
    });
    expect(ingestionQueue.addBuildRagChunks).not.toHaveBeenCalled();
  });

  it('does not mark a completed conversion as failed when scheduling fails', async () => {
    const queueError = new Error('Queue is unavailable');
    ingestionQueue.addBuildRagChunks.mockRejectedValue(queueError);

    await expect(job.process({ sourceId })).rejects.toBe(queueError);

    expect(processingStageDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: ProcessingState.COMPLETED }),
      }),
    );
    expect(processingStageDelegate.updateMany).not.toHaveBeenCalled();
  });

  it('preserves the original failure when failure-state persistence also fails', async () => {
    const conversionError = new Error('Conversion failed');
    doclingService.client.convertFromFile.mockRejectedValue(conversionError);
    processingStageDelegate.updateMany.mockRejectedValue(
      new Error('Database failed'),
    );

    await expect(job.process({ sourceId })).rejects.toBe(conversionError);
  });
});
