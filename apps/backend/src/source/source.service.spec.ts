import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma/prisma.service';
import { SourceService } from './source.service';
import type { SourceUploadFile } from './source.types';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SourceService', () => {
  let service: SourceService;
  const moduleDelegate = {
    findFirst: jest.fn(),
  };
  const documentDelegate = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourceService,
        {
          provide: PrismaService,
          useValue: {
            module: moduleDelegate,
            document: documentDelegate,
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
    expect(documentDelegate.create).not.toHaveBeenCalled();
  });

  it('creates a pending source document', async () => {
    moduleDelegate.findFirst.mockResolvedValue({ id: 'module-id' });
    documentDelegate.create.mockResolvedValue({
      id: 'source-id',
      name: 'lecture-notes',
      originalName: 'lecture-notes.pdf',
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
      name: 'lecture-notes',
      originalName: 'lecture-notes.pdf',
      mimeType: 'application/pdf',
      status: 'PENDING',
      moduleId: 'module-id',
    });

    expect(moduleDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '2e5c9c12-a0bd-455b-8411-9564e38e81d6', userId: 'user-id' },
      }),
    );
    expect(documentDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'lecture-notes',
          originalName: 'lecture-notes.pdf',
          mimeType: 'application/pdf',
          moduleId: '2e5c9c12-a0bd-455b-8411-9564e38e81d6',
        },
      }),
    );
  });
});

function createFile(originalName = 'notes.pdf'): SourceUploadFile {
  return {
    originalname: originalName,
    mimetype: 'application/pdf',
  };
}
