import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma/prisma.service';
import { SourceService } from './source.service';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
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
      ],
    }).compile();

    service = module.get<SourceService>(SourceService);
    jest.clearAllMocks();
  });

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

function createFile(originalName = 'notes.pdf'): Express.Multer.File {
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
  } as Express.Multer.File;
}
