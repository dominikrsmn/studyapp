import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { SemestersController } from './semesters.controller';
import { SemestersService } from './semesters.service';

describe('SemestersController', () => {
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const semestersService = {
    findAll: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };
  let controller: SemestersController;

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      controllers: [SemestersController],
      providers: [{ provide: SemestersService, useValue: semestersService }],
    }).compile();
    controller = testingModule.get(SemestersController);
    jest.clearAllMocks();
  });

  it('creates a semester for the authenticated user', async () => {
    const input = {
      startDate: '2026-10-01T00:00:00.000Z',
      endDate: '2027-03-31T00:00:00.000Z',
    };
    await controller.create(request, input);
    expect(semestersService.create).toHaveBeenCalledWith('user-id', input);
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      controller.create(request, {
        startDate: '2027-03-31T00:00:00.000Z',
        endDate: '2026-10-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });
});
