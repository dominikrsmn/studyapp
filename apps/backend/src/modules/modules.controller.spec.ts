import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ModulesController } from './modules.controller';
import { ModulesService } from './modules.service';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ModulesController', () => {
  let controller: ModulesController;
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

    await expect(controller.findAll('user-id')).resolves.toEqual([]);
    expect(modulesService.findAll).toHaveBeenCalledWith({ userId: 'user-id' });
  });

  it('rejects an invalid create request', () => {
    expect(() => controller.create({ name: '' })).toThrow(BadRequestException);
    expect(modulesService.create).not.toHaveBeenCalled();
  });
});
