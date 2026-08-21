import { Logger, NotFoundException } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { SourceIngestionQueue } from '../ingestion/source-ingestion.queue';
import { SourceService } from './source.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../ingestion/source-ingestion.queue', () => ({
  SourceIngestionQueue: class SourceIngestionQueue {},
}));
describe('SourceService', () => {
  let service: SourceService;
  const moduleDelegate = {
    findFirst: jest.fn(),
  };
  const sourceDelegate = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  };
  const fileStorageService = {
    save: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  };
  const sourceIngestionQueue = {
    enqueue: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceService,
        {
          provide: PrismaService,
          useValue: {
            module: moduleDelegate,
            source: sourceDelegate,
          },
        },
        { provide: FileStorageService, useValue: fileStorageService },
        { provide: SourceIngestionQueue, useValue: sourceIngestionQueue },
      ],
    }).compile();

    service = module.get<SourceService>(SourceService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    fileStorageService.save.mockResolvedValue(undefined);
    fileStorageService.delete.mockResolvedValue(undefined);
    fileStorageService.deleteMany.mockResolvedValue(undefined);
    sourceDelegate.delete.mockResolvedValue(undefined);
    sourceIngestionQueue.enqueue.mockResolvedValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when the module does not belong to the user', async () => {
    moduleDelegate.findFirst.mockResolvedValue(null);

    await expect(
      service.uploadSource(
        'user-id',
        '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
        createFile(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(sourceDelegate.create).not.toHaveBeenCalled();
  });

  it('creates a pending source document', async () => {
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    sourceDelegate.create.mockResolvedValue({
      id: 'source-id',
      name: 'lecture-notes.pdf',
      type: 'DOCUMENT',
      mimeType: 'application/pdf',
      status: 'PENDING',
      moduleId: 'module-id',
    });

    await expect(
      service.uploadSource(
        'user-id',
        '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
        createFile('lecture-notes.pdf'),
      ),
    ).resolves.toEqual({
      id: 'source-id',
      name: 'lecture-notes.pdf',
      type: 'DOCUMENT',
      mimeType: 'application/pdf',
      status: 'PENDING',
      moduleId: 'module-id',
    });

    expect(moduleDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
          semester: { userId: 'user-id' },
        },
      }),
    );
    expect(sourceDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'lecture-notes.pdf',
          type: 'DOCUMENT',
          mimeType: 'application/pdf',
          moduleId: '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
        }),
      }),
    );
    expect(fileStorageService.save.mock.invocationCallOrder[0]).toBeLessThan(
      sourceDelegate.create.mock.invocationCallOrder[0],
    );
    expect(sourceIngestionQueue.enqueue).toHaveBeenCalledWith(
      expect.any(String),
    );
  });

  it('does not create metadata when storing the file fails', async () => {
    const storageError = new Error('disk full');
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    fileStorageService.save.mockRejectedValue(storageError);

    await expect(
      service.uploadSource('user-id', 'module-id', createFile()),
    ).rejects.toBe(storageError);

    expect(sourceDelegate.create).not.toHaveBeenCalled();
    expect(sourceIngestionQueue.enqueue).not.toHaveBeenCalled();
    expect(fileStorageService.delete).toHaveBeenCalledTimes(1);
  });

  it('preserves the database error when file cleanup also fails', async () => {
    const databaseError = new Error('database unavailable');
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    sourceDelegate.create.mockRejectedValue(databaseError);
    fileStorageService.delete.mockRejectedValue(new Error('cleanup failed'));

    await expect(
      service.uploadSource('user-id', 'module-id', createFile()),
    ).rejects.toBe(databaseError);

    expect(fileStorageService.delete).toHaveBeenCalledTimes(1);
    expect(sourceIngestionQueue.enqueue).not.toHaveBeenCalled();
  });

  it('cleans up the source when queueing fails', async () => {
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    sourceDelegate.create.mockResolvedValue({
      id: 'source-id',
      name: 'notes.pdf',
      type: 'DOCUMENT',
      mimeType: 'application/pdf',
      status: 'PENDING',
      moduleId: 'module-id',
    });
    const queueError = new Error('redis unavailable');
    sourceIngestionQueue.enqueue.mockRejectedValue(queueError);

    await expect(
      service.uploadSource('user-id', 'module-id', createFile()),
    ).rejects.toBe(queueError);

    expect(sourceDelegate.delete).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
    });
    expect(fileStorageService.delete).toHaveBeenCalledWith(expect.any(String));
  });

  it('lists source only after checking module ownership', async () => {
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    sourceDelegate.findMany.mockResolvedValue([]);

    await expect(service.findAll('user-id', 'module-id')).resolves.toEqual([]);

    expect(moduleDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'module-id', semester: { userId: 'user-id' } },
      select: { id: true },
    });
    expect(sourceDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { moduleId: 'module-id' } }),
    );
  });

  it('does not delete a source owned by another user', async () => {
    sourceDelegate.findFirst.mockResolvedValue(null);

    await expect(service.remove('user-id', 'source-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(sourceDelegate.delete).not.toHaveBeenCalled();
  });

  it('deletes source storage through FileStorageService', async () => {
    sourceDelegate.findFirst.mockResolvedValue({
      id: 'source-id',
      name: 'notes.pdf',
      type: 'DOCUMENT',
      mimeType: 'application/pdf',
      status: 'READY',
      moduleId: 'module-id',
      storageKey: 'storage-key',
    });
    sourceDelegate.delete.mockResolvedValue({
      id: 'source-id',
      name: 'notes.pdf',
      type: 'DOCUMENT',
      mimeType: 'application/pdf',
      status: 'READY',
      moduleId: 'module-id',
    });

    await service.remove('user-id', 'source-id');

    expect(fileStorageService.deleteMany).toHaveBeenCalledWith(['storage-key']);
    expect(sourceDelegate.delete.mock.invocationCallOrder[0]).toBeLessThan(
      fileStorageService.deleteMany.mock.invocationCallOrder[0],
    );
  });
});

function createFile(
  originalName = 'notes.pdf',
): Parameters<SourceService['uploadSource']>[2] {
  return {
    fieldname: 'file',
    originalname: originalName,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 3,
    buffer: Buffer.from('pdf'),
    stream: undefined as never,
    destination: '',
    filename: originalName,
    path: '',
  } as Parameters<SourceService['uploadSource']>[2];
}
