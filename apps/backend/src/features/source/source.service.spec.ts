import { NotFoundException } from '@nestjs/common';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { IngestionQueue } from './ingestion/ingestion.queue';
import { SourceService } from './source.service';
import type { SourceProcessingStageService } from './ingestion/source-processing-stage.service';
import {
  ProcessingState,
  SourceProcessingStageType,
} from '../../infrastructure/database/generated/enums';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SourceService', () => {
  const moduleDelegate = {
    findFirst: jest.fn(),
  };
  const sourceDelegate = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  };
  const fileStorageService = {
    save: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const ingestionQueue = {
    addParseDocument: jest.fn(),
  };
  const sourceProcessingStageService = {
    initialize: jest.fn(),
  };

  let service: SourceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SourceService(
      {
        module: moduleDelegate,
        source: sourceDelegate,
      } as unknown as PrismaService,
      fileStorageService as unknown as FileStorageService,
      ingestionQueue as unknown as IngestionQueue,
      sourceProcessingStageService as unknown as SourceProcessingStageService,
    );

    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    fileStorageService.save.mockResolvedValue(undefined);
    fileStorageService.delete.mockResolvedValue(undefined);
    sourceDelegate.create.mockResolvedValue({
      id: 'source-id',
      name: 'lecture.pdf',
      mimeType: 'application/pdf',
      moduleId: 'module-id',
      processingStages: [],
    });
    sourceDelegate.findUnique.mockResolvedValue(
      sourceRecord(queuedProcessingStages()),
    );
    sourceDelegate.delete.mockResolvedValue({ id: 'source-id' });
    ingestionQueue.addParseDocument.mockResolvedValue(undefined);
    sourceProcessingStageService.initialize.mockResolvedValue(
      initialProcessingStages(),
    );
  });

  it('enqueues the uploaded source for document parsing', async () => {
    const result = await service.uploadSource(
      'user-id',
      'module-id',
      sourceFile(),
    );

    const sourceId = sourceDelegate.create.mock.calls[0][0].data.id;
    expect(fileStorageService.save).toHaveBeenCalledWith(
      Buffer.from('pdf'),
      sourceId,
    );
    expect(ingestionQueue.addParseDocument).toHaveBeenCalledWith(sourceId);
    expect(sourceProcessingStageService.initialize).toHaveBeenCalledWith(
      sourceId,
    );
    expect(sourceDelegate.create.mock.invocationCallOrder[0]).toBeLessThan(
      ingestionQueue.addParseDocument.mock.invocationCallOrder[0],
    );
    expect(sourceDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ type: expect.anything() }),
        select: expect.objectContaining({
          processingStages: {
            select: { stage: true, state: true, errorMessage: true },
          },
        }),
      }),
    );
    expect(result).toEqual({
      id: 'source-id',
      name: 'lecture.pdf',
      mimeType: 'application/pdf',
      moduleId: 'module-id',
      processingStages: queuedProcessingStages(),
    });
  });

  it('returns the source processing stages', async () => {
    const processingStages = [
      {
        stage: SourceProcessingStageType.CONVERSION,
        state: ProcessingState.COMPLETED,
        errorMessage: null,
      },
    ];
    sourceDelegate.findMany.mockResolvedValue([sourceRecord(processingStages)]);

    const sources = await service.findAll('user-id', 'module-id');

    expect(sources[0]?.processingStages).toEqual(processingStages);
  });

  it('scopes deletion to the module from the route', async () => {
    sourceDelegate.findFirst.mockResolvedValue({
      ...sourceRecord([]),
      storageKey: null,
    });
    sourceDelegate.delete.mockResolvedValue(sourceRecord([]));

    await service.remove('user-id', 'module-id', 'source-id');

    expect(sourceDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'source-id',
          moduleId: 'module-id',
          module: { semester: { userId: 'user-id' } },
        },
      }),
    );
  });

  it('removes the source and file when enqueueing fails', async () => {
    const queueError = new Error('queue unavailable');
    ingestionQueue.addParseDocument.mockRejectedValue(queueError);

    await expect(
      service.uploadSource('user-id', 'module-id', sourceFile()),
    ).rejects.toBe(queueError);

    const sourceId = sourceDelegate.create.mock.calls[0][0].data.id;
    expect(sourceDelegate.delete).toHaveBeenCalledWith({
      where: { id: sourceId },
    });
    expect(fileStorageService.delete).toHaveBeenCalledWith(sourceId);
  });

  it('does not store or enqueue a source for an inaccessible module', async () => {
    moduleDelegate.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadSource('user-id', 'module-id', sourceFile()),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(fileStorageService.save).not.toHaveBeenCalled();
    expect(sourceDelegate.create).not.toHaveBeenCalled();
    expect(ingestionQueue.addParseDocument).not.toHaveBeenCalled();
    expect(sourceProcessingStageService.initialize).not.toHaveBeenCalled();
  });
});

function initialProcessingStages() {
  return Object.values(SourceProcessingStageType).map((stage) => ({
    id: `${stage}-stage-id`,
    sourceId: 'source-id',
    stage,
    state: ProcessingState.NOT_STARTED,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }));
}

function queuedProcessingStages() {
  return initialProcessingStages().map((processingStage) =>
    processingStage.stage === SourceProcessingStageType.CONVERSION
      ? { ...processingStage, state: ProcessingState.QUEUED }
      : processingStage,
  );
}

function sourceFile(): Express.Multer.File {
  return {
    buffer: Buffer.from('pdf'),
    originalname: 'lecture.pdf',
    mimetype: 'application/pdf',
  } as Express.Multer.File;
}

function sourceRecord(
  processingStages: Array<{
    stage: SourceProcessingStageType;
    state: ProcessingState;
    errorMessage: string | null;
  }>,
) {
  return {
    id: 'source-id',
    name: 'lecture.pdf',
    mimeType: 'application/pdf',
    moduleId: 'module-id',
    processingStages,
  };
}
