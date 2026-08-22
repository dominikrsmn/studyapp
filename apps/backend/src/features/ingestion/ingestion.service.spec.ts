import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { EmbeddingService } from './embedding/embedding.service';
import { IngestionService } from './ingestion.service';
import type { Chunk } from './ingestion.service';
import { PdfTextExtractorService } from './pdf-text-extractor/pdf-text-extractor.service';
import { TextProcessingService } from '../../shared/text-processing/text-processing.service';
import { TopicAnalysisQueue } from '../topic/topic-analysis.queue';
import { PayloadTooLargeException } from '@nestjs/common';
import type { PageTextResult } from 'pdf-parse';
import { ingestionConfig } from './ingestion.config';

const BATCH_SIZE = 64;
const MAX_PAGES = 300;
const MAX_TEXT_CHARACTERS = 2_000_000;

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
    sourceChunk: {
      deleteMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };
  const fileStorageService = { read: jest.fn() };
  const pdfTextExtractor = { extract: jest.fn() };
  const textProcessingService = { chunkForRag: jest.fn() };
  const embeddingService = { embedChunks: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const topicAnalysisQueue = { enqueue: jest.fn() };
  const config = {
    ...ingestionConfig(),
    embedding: { ...ingestionConfig().embedding, batchSize: BATCH_SIZE },
    document: {
      maxPages: MAX_PAGES,
      maxTextCharacters: MAX_TEXT_CHARACTERS,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new IngestionService(
      prismaService as unknown as PrismaService,
      fileStorageService as unknown as FileStorageService,
      pdfTextExtractor as unknown as PdfTextExtractorService,
      textProcessingService as unknown as TextProcessingService,
      embeddingService as unknown as EmbeddingService,
      eventEmitter as unknown as EventEmitter2,
      topicAnalysisQueue as unknown as TopicAnalysisQueue,
      config,
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

    await expect(service.ingest(sourceId)).rejects.toBe(extractionError);

    expect(prismaService.source.updateMany).toHaveBeenCalledWith({
      where: { id: sourceId },
      data: { status: 'FAILED' },
    });
    expect(prismaService.sourceChunk.deleteMany).toHaveBeenCalledWith({
      where: { sourceId },
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

    await expect(service.ingest(sourceId)).rejects.toBe(processingError);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      `Failed to mark source "${sourceId}" as failed`,
      expect.any(String),
    );
  });

  it('embeds and inserts chunks in bounded batches with global indexes', async () => {
    const chunkContents = Array.from(
      { length: BATCH_SIZE + 1 },
      (_, index) => `chunk-${index}`,
    );
    prismaService.source.update
      .mockResolvedValueOnce({
        storageKey: sourceId,
        module: { id: moduleId, semester: { userId: 'user-id' } },
      })
      .mockResolvedValueOnce({});
    fileStorageService.read.mockResolvedValue(Buffer.from('pdf'));
    pdfTextExtractor.extract.mockResolvedValue([page('text')]);
    textProcessingService.chunkForRag.mockReturnValue(chunkContents);
    embeddingService.embedChunks.mockImplementation(
      async (_source: unknown, chunks: Chunk[], startIndex: number) =>
        chunks.map((chunk, index) => ({
          ...chunk,
          index: startIndex + index,
          embedding: [index],
        })),
    );

    await service.ingest(sourceId);

    expect(prismaService.sourceChunk.deleteMany).toHaveBeenCalledWith({
      where: { sourceId },
    });
    expect(
      prismaService.sourceChunk.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(prismaService.$executeRaw.mock.invocationCallOrder[0]);
    expect(embeddingService.embedChunks).toHaveBeenCalledTimes(2);
    expect(embeddingService.embedChunks.mock.calls[0][1]).toHaveLength(
      BATCH_SIZE,
    );
    expect(embeddingService.embedChunks.mock.calls[0][2]).toBe(0);
    expect(embeddingService.embedChunks.mock.calls[1][1]).toHaveLength(1);
    expect(embeddingService.embedChunks.mock.calls[1][2]).toBe(BATCH_SIZE);
    expect(prismaService.$executeRaw).toHaveBeenCalledTimes(2);
    expect(topicAnalysisQueue.enqueue).toHaveBeenCalledWith(sourceId);
  });

  it('rejects PDFs over the page limit before chunking', async () => {
    arrangeDocument(
      Array.from({ length: MAX_PAGES + 1 }, (_, index) => page('', index + 1)),
    );

    await expect(service.ingest(sourceId)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );

    expect(textProcessingService.chunkForRag).not.toHaveBeenCalled();
    expect(embeddingService.embedChunks).not.toHaveBeenCalled();
  });

  it('rejects PDFs over the extracted-text limit before chunking', async () => {
    arrangeDocument([page('x'.repeat(MAX_TEXT_CHARACTERS + 1))]);

    await expect(service.ingest(sourceId)).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );

    expect(textProcessingService.chunkForRag).not.toHaveBeenCalled();
    expect(embeddingService.embedChunks).not.toHaveBeenCalled();
  });

  function arrangeDocument(pages: PageTextResult[]): void {
    prismaService.source.update.mockResolvedValue({
      storageKey: sourceId,
      module: { id: moduleId, semester: { userId: 'user-id' } },
    });
    prismaService.source.updateMany.mockResolvedValue({ count: 1 });
    prismaService.sourceChunk.deleteMany.mockResolvedValue({ count: 0 });
    fileStorageService.read.mockResolvedValue(Buffer.from('pdf'));
    pdfTextExtractor.extract.mockResolvedValue(pages);
  }
});

function page(text: string, num = 1): PageTextResult {
  return { text, num } as PageTextResult;
}
