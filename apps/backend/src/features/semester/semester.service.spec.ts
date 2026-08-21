import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { SemesterService } from './semester.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('SemesterService', () => {
  let service: SemesterService;
  const semesterDelegate = {
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
        SemesterService,
        {
          provide: PrismaService,
          useValue: { semester: semesterDelegate, source: sourceDelegate },
        },
        { provide: FileStorageService, useValue: fileStorageService },
      ],
    }).compile();

    service = testingModule.get(SemesterService);
    jest.clearAllMocks();
    fileStorageService.deleteAll.mockResolvedValue(undefined);
  });

  it('cleans up all source files after deleting a semester', async () => {
    semesterDelegate.findFirst.mockResolvedValue({
      id: 'semester-id',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T00:00:00.000Z'),
    });
    sourceDelegate.findMany.mockResolvedValue([
      { storageKey: 'first-key' },
      { storageKey: 'second-key' },
    ]);
    semesterDelegate.delete.mockResolvedValue({ id: 'semester-id' });

    await service.remove('user-id', 'semester-id');

    expect(sourceDelegate.findMany).toHaveBeenCalledWith({
      where: { module: { semesterId: 'semester-id' } },
      select: { storageKey: true },
    });
    expect(fileStorageService.deleteAll).toHaveBeenCalledWith([
      'first-key',
      'second-key',
    ]);
    expect(semesterDelegate.delete.mock.invocationCallOrder[0]).toBeLessThan(
      fileStorageService.deleteAll.mock.invocationCallOrder[0],
    );
  });
});
