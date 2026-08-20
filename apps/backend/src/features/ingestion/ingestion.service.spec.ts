import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { EmbeddingService } from './embedding/embedding.service';
import { IngestionService } from './ingestion.service';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextChunkerService } from './text-chunker/text-chunker.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../../infrastructure/database/generated/client', () => ({
  Prisma: {
    sql: jest.fn(),
    join: jest.fn(),
  },
}));

describe('IngestionService', () => {
  let service: IngestionService;
  const sourceId = 'f43ff589-36b0-4f0f-b0cf-9cc1101b1952';
  const moduleId = 'f74a46b6-2d6d-4542-a9b8-37a8eef82d8c';
  const prismaService = {
    source: {
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };
  const fileStorageService = { read: jest.fn() };
  const pdfTextExtractor = { extract: jest.fn() };
  const textChunker = { chunk: jest.fn() };
  const embeddingService = { embed: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new IngestionService(
      prismaService as unknown as PrismaService,
      fileStorageService as unknown as FileStorageService,
      pdfTextExtractor as unknown as PdfTextExtractorService,
      textChunker as unknown as TextChunkerService,
      embeddingService as unknown as EmbeddingService,
      eventEmitter as unknown as EventEmitter2,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('marks the source as failed when processing fails', async () => {
    const extractionError = new Error('invalid PDF');
    prismaService.source.update.mockResolvedValue({
      storageKey: sourceId,
      module: { id: moduleId, semester: { userId: 'user-id' } },
    });
    prismaService.source.updateMany.mockResolvedValue({ count: 1 });
    fileStorageService.read.mockResolvedValue(Buffer.from('pdf'));
    pdfTextExtractor.extract.mockRejectedValue(extractionError);

    await expect(service.ingest(sourceId, moduleId)).rejects.toBe(
      extractionError,
    );

    expect(prismaService.source.updateMany).toHaveBeenCalledWith({
      where: { id: sourceId },
      data: { status: 'FAILED' },
    });
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      1,
      'source.stateChanged',
      {
        sourceId,
        moduleId,
        processingState: 'PROCESSING',
      },
    );
    expect(eventEmitter.emit).toHaveBeenNthCalledWith(
      2,
      'source.stateChanged',
      {
        sourceId,
        moduleId,
        processingState: 'FAILED',
      },
    );
  });

  it('does not mask the ingestion error if persisting FAILED also fails', async () => {
    const processingError = new Error('database unavailable');
    prismaService.source.update.mockRejectedValue(processingError);
    prismaService.source.updateMany.mockRejectedValue(
      new Error('status update failed'),
    );

    await expect(service.ingest(sourceId, moduleId)).rejects.toBe(
      processingError,
    );

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      `Failed to mark source "${sourceId}" as failed (gg)`,
      expect.any(String),
    );
  });
});
