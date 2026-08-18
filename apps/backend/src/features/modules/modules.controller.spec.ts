import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

jest.mock('../../infrastructure/database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ModulesController', () => {
  let controller: ModulesController;
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const semesterId = 'semester-id';
  const modulesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const semesterDelegate = {
    findFirst: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModulesController],
      providers: [
        {
          provide: ModulesService,
          useValue: modulesService,
        },
        {
          provide: PrismaService,
          useValue: { semester: semesterDelegate },
        },
      ],
    }).compile();

    controller = module.get<ModulesController>(ModulesController);
    jest.clearAllMocks();
    semesterDelegate.findFirst.mockResolvedValue({ id: semesterId });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listing modules with the semester id', async () => {
    modulesService.findAll.mockResolvedValue([]);

    await expect(controller.findAll(request, semesterId)).resolves.toEqual([]);
    expect(modulesService.findAll).toHaveBeenCalledWith(semesterId);
  });

  it('creates a module in the semester', async () => {
    const body = { name: 'Mathematics' };
    modulesService.create.mockResolvedValue({ id: 'module-id', ...body });

    await controller.create(request, semesterId, body);

    expect(modulesService.create).toHaveBeenCalledWith(semesterId, body);
  });

  it('scopes module lookup to the semester', async () => {
    modulesService.findOne.mockResolvedValue({});

    await controller.findOne(request, semesterId, 'module-id');

    expect(modulesService.findOne).toHaveBeenCalledWith(
      semesterId,
      'module-id',
    );
  });

  it('scopes module updates to the semester', async () => {
    modulesService.update.mockResolvedValue({});

    await controller.update(request, semesterId, 'module-id', {
      name: 'Physics',
    });

    expect(modulesService.update).toHaveBeenCalledWith(
      semesterId,
      'module-id',
      { name: 'Physics' },
    );
  });

  it('scopes module deletion to the semester', async () => {
    modulesService.remove.mockResolvedValue({});

    await controller.remove(request, semesterId, 'module-id');

    expect(modulesService.remove).toHaveBeenCalledWith(
      semesterId,
      'module-id',
    );
  });

  it('rejects an invalid create request', async () => {
    await expect(
      controller.create(request, semesterId, { name: '' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(modulesService.create).not.toHaveBeenCalled();
  });

  it('verifies that the authenticated user owns the semester', async () => {
    modulesService.findAll.mockResolvedValue([]);

    await controller.findAll(request, semesterId);

    expect(semesterDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: semesterId, userId: request.userId },
      select: { id: true },
    });
  });

  it('does not access modules when the user does not own the semester', async () => {
    semesterDelegate.findFirst.mockResolvedValue(null);

    await expect(
      controller.findAll(request, semesterId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(modulesService.findAll).not.toHaveBeenCalled();
  });
});
