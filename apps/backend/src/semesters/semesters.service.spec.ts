import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../database/prisma/prisma.service';
import { SemestersService } from './semesters.service';

describe('SemestersService', () => {
  const semester = {
    id: 'semester-id',
    startDate: new Date('2026-10-01T00:00:00.000Z'),
    endDate: new Date('2027-03-31T00:00:00.000Z'),
  };
  const semesterDelegate = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  };
  let service: SemestersService;

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      providers: [
        SemestersService,
        {
          provide: PrismaService,
          useValue: { semester: semesterDelegate },
        },
      ],
    }).compile();
    service = testingModule.get(SemestersService);
    jest.clearAllMocks();
  });

  it('lists only semesters owned by the user', async () => {
    semesterDelegate.findMany.mockResolvedValue([semester]);

    await expect(service.findAll('user-id')).resolves.toEqual([
      {
        id: 'semester-id',
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2027-03-31T00:00:00.000Z',
      },
    ]);
    expect(semesterDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-id' } }),
    );
  });

  it('does not delete a semester owned by another user', async () => {
    semesterDelegate.findFirst.mockResolvedValue(null);

    await expect(
      service.remove('user-id', 'semester-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(semesterDelegate.delete).not.toHaveBeenCalled();
  });
});
