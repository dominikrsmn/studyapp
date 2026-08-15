import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { PrismaService } from '../database/prisma/prisma.service';

jest.mock('../database/prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('ModulesService', () => {
  let service: ModulesService;
  const moduleDelegate = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModulesService,
        {
          provide: PrismaService,
          useValue: { module: moduleDelegate },
        },
      ],
    }).compile();

    service = module.get<ModulesService>(ModulesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a module', async () => {
    const request = {
      name: 'Mathematics',
      description: 'Exam preparation',
    };
    const userId = '2e5c9c12-a0bd-455b-8411-9564e38e81d6';
    const createdModule = {
      id: '9e3c2355-5874-4980-a9a5-b4fe8b153cc9',
      name: request.name,
      description: request.description,
    };
    moduleDelegate.create.mockResolvedValue(createdModule);

    await expect(service.create(userId, request)).resolves.toEqual(
      createdModule,
    );
    expect(moduleDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ...request, userId } }),
    );
  });

  it('lists modules for one user', async () => {
    moduleDelegate.findMany.mockResolvedValue([]);

    await expect(service.findAll('user-id')).resolves.toEqual([]);
    expect(moduleDelegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-id' } }),
    );
  });

  it('throws when a module does not exist', async () => {
    moduleDelegate.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('user-id', 'missing-id'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(moduleDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'missing-id', userId: 'user-id' },
      }),
    );
  });

  it('updates an existing module', async () => {
    const existingModule = {
      id: 'module-id',
      name: 'Old name',
      description: null,
    };
    const updatedModule = { ...existingModule, name: 'New name' };
    moduleDelegate.findFirst.mockResolvedValue(existingModule);
    moduleDelegate.update.mockResolvedValue(updatedModule);

    await expect(
      service.update('user-id', 'module-id', { name: 'New name' }),
    ).resolves.toEqual(updatedModule);
    expect(moduleDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'module-id', userId: 'user-id' },
      }),
    );
    expect(moduleDelegate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'module-id' },
        data: { name: 'New name' },
      }),
    );
  });

  it('deletes an existing module', async () => {
    const existingModule = {
      id: 'module-id',
      name: 'Mathematics',
      description: null,
    };
    moduleDelegate.findFirst.mockResolvedValue(existingModule);
    moduleDelegate.delete.mockResolvedValue(existingModule);

    await expect(service.remove('user-id', 'module-id')).resolves.toEqual(
      existingModule,
    );
    expect(moduleDelegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'module-id', userId: 'user-id' },
      }),
    );
    expect(moduleDelegate.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'module-id' } }),
    );
  });
});
