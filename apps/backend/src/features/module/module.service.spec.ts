import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { ModuleService } from './module.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ModuleService', () => {
  let service: ModuleService;
  const moduleDelegate = {
    findFirst: jest.fn(),
    delete: jest.fn(),
  };
  const sourceDelegate = {
    findMany: jest.fn(),
  };
  const fileStorageService = {
    deleteMany: jest.fn(),
  };

  beforeEach(async () => {
    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        ModuleService,
        {
          provide: PrismaService,
          useValue: { module: moduleDelegate, source: sourceDelegate },
        },
        { provide: FileStorageService, useValue: fileStorageService },
      ],
    }).compile();

    service = testingModule.get(ModuleService);
    jest.clearAllMocks();
    fileStorageService.deleteMany.mockResolvedValue(undefined);
  });

  it('cleans up all source files after deleting a module', async () => {
    moduleDelegate.findFirst.mockResolvedValue({
      id: 'module-id',
      name: 'Algorithms',
      description: null,
      icon: 'book',
      examDate: null,
    });
    sourceDelegate.findMany.mockResolvedValue([
      { storageKey: 'first-key' },
      { storageKey: null },
      { storageKey: 'second-key' },
    ]);
    moduleDelegate.delete.mockResolvedValue({ id: 'module-id' });

    await service.remove('semester-id', 'module-id');

    expect(sourceDelegate.findMany).toHaveBeenCalledWith({
      where: { moduleId: 'module-id' },
      select: { storageKey: true },
    });
    expect(fileStorageService.deleteMany).toHaveBeenCalledWith([
      'first-key',
      'second-key',
    ]);
    expect(moduleDelegate.delete.mock.invocationCallOrder[0]).toBeLessThan(
      fileStorageService.deleteMany.mock.invocationCallOrder[0],
    );
  });
});

describe('Module graph version', () => {
  const current = {
    id: 'module-id',
    name: 'Algorithms',
    description: null,
    icon: 'book',
    examDate: null,
    graphVersion: 4,
  };
  const module = { findFirst: jest.fn(), update: jest.fn() };
  const prisma = {
    $transaction: (operation: (tx: unknown) => unknown) =>
      operation({ module }),
  };
  const service = new ModuleService(
    prisma as unknown as PrismaService,
    {} as FileStorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    module.findFirst.mockResolvedValue(current);
    module.update.mockResolvedValue(current);
  });

  it.each([
    { name: 'Graph algorithms' },
    { description: 'Graph theory' },
    { name: 'Algorithms' },
    { icon: 'star' },
    { examDate: null },
  ])('preserves graph version for module metadata: %j', async (request) => {
    const result = await service.update('semester-id', 'module-id', request);
    expect(module.update.mock.calls[0][0].data).not.toHaveProperty(
      'graphVersion',
    );
    expect(module.update.mock.calls[0][0].data).not.toHaveProperty(
      'contentRevision',
    );
    expect(result.graphVersion).toBe(4);
    expect(result).not.toHaveProperty('contentRevision');
  });
});
