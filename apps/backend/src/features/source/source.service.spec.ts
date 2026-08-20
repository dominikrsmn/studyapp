import { Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { SourceService } from './source.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));
jest.mock('../ingestion/ingestion.service', () => ({
  IngestionService: class IngestionService {},
}));
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
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
  };
  const ingestionService = {
    ingest: jest.fn(),
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
        { provide: IngestionService, useValue: ingestionService },
      ],
    }).compile();

    service = module.get<SourceService>(SourceService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    fileStorageService.save.mockResolvedValue(undefined);
    fileStorageService.delete.mockResolvedValue(undefined);
    ingestionService.ingest.mockResolvedValue(undefined);
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
    expect(ingestionService.ingest).toHaveBeenCalledTimes(1);
  });

  it('does not create metadata when storing the file fails', async () => {
    const storageError = new Error('disk full');
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    fileStorageService.save.mockRejectedValue(storageError);

    await expect(
      service.uploadSource('user-id', 'module-id', createFile()),
    ).rejects.toBe(storageError);

    expect(sourceDelegate.create).not.toHaveBeenCalled();
    expect(ingestionService.ingest).not.toHaveBeenCalled();
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
    expect(ingestionService.ingest).not.toHaveBeenCalled();
  });

  it('handles a rejected background ingestion task', async () => {
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    sourceDelegate.create.mockResolvedValue({
      id: 'source-id',
      name: 'notes.pdf',
      type: 'DOCUMENT',
      mimeType: 'application/pdf',
      status: 'PENDING',
      moduleId: 'module-id',
    });
    ingestionService.ingest.mockRejectedValue(new Error('ingestion failed'));

    await expect(
      service.uploadSource('user-id', 'module-id', createFile()),
    ).resolves.toMatchObject({ status: 'PENDING' });

    expect(ingestionService.ingest).toHaveBeenCalledTimes(1);
  });

  it('lists sources only after checking module ownership', async () => {
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

    await expect(
      service.remove('user-id', 'source-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(sourceDelegate.delete).not.toHaveBeenCalled();
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
