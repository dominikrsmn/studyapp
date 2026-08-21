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
    deleteAll: jest.fn(),
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
    fileStorageService.deleteAll.mockResolvedValue(undefined);
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
    expect(fileStorageService.deleteAll).toHaveBeenCalledWith([
      'first-key',
      'second-key',
    ]);
    expect(moduleDelegate.delete.mock.invocationCallOrder[0]).toBeLessThan(
      fileStorageService.deleteAll.mock.invocationCallOrder[0],
    );
  });
});
