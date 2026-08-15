import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ModulesController', () => {
  let controller: ModulesController;
  const request = { userId: 'user-id' } as AuthenticatedRequest;
  const modulesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModulesController],
      providers: [
        {
          provide: ModulesService,
          useValue: modulesService,
        },
      ],
    }).compile();

    controller = module.get<ModulesController>(ModulesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates listing modules with the user id', async () => {
    modulesService.findAll.mockResolvedValue([]);

    await expect(controller.findAll(request)).resolves.toEqual([]);
    expect(modulesService.findAll).toHaveBeenCalledWith('user-id');
  });

  it('creates a module for the authenticated user', async () => {
    const body = { name: 'Mathematics' };
    modulesService.create.mockResolvedValue({ id: 'module-id', ...body });

    await controller.create(request, body);

    expect(modulesService.create).toHaveBeenCalledWith('user-id', body);
  });

  it('scopes module lookup to the authenticated user', async () => {
    modulesService.findOne.mockResolvedValue({});

    await controller.findOne(request, 'module-id');

    expect(modulesService.findOne).toHaveBeenCalledWith('user-id', 'module-id');
  });

  it('scopes module updates to the authenticated user', async () => {
    modulesService.update.mockResolvedValue({});

    await controller.update(request, 'module-id', { name: 'Physics' });

    expect(modulesService.update).toHaveBeenCalledWith('user-id', 'module-id', {
      name: 'Physics',
    });
  });

  it('scopes module deletion to the authenticated user', async () => {
    modulesService.remove.mockResolvedValue({});

    await controller.remove(request, 'module-id');

    expect(modulesService.remove).toHaveBeenCalledWith('user-id', 'module-id');
  });

  it('rejects an invalid create request', () => {
    expect(() => controller.create(request, { name: '' })).toThrow(
      BadRequestException,
    );
    expect(modulesService.create).not.toHaveBeenCalled();
  });
});
