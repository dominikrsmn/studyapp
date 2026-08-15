import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateModule, ModuleDto, UpdateModule } from '@study/contracts';
import { PrismaService } from '../database/prisma/prisma.service';

const moduleSelect = {
  id: true,
  name: true,
  description: true,
} as const;

@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    createModuleRequest: CreateModule,
  ): Promise<ModuleDto> {
    return this.prisma.module.create({
      data: {
        name: createModuleRequest.name,
        description: createModuleRequest.description,
        userId,
      },
      select: moduleSelect,
    });
  }

  async findAll(userId: string): Promise<ModuleDto[]> {
    return this.prisma.module.findMany({
      where: { userId },
      select: moduleSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string): Promise<ModuleDto> {
    const module = await this.prisma.module.findFirst({
      where: { id, userId },
      select: moduleSelect,
    });

    if (!module) {
      throw new NotFoundException(`Module with id "${id}" was not found`);
    }

    return module;
  }

  async update(
    userId: string,
    id: string,
    updateModuleRequest: UpdateModule,
  ): Promise<ModuleDto> {
    await this.findOne(userId, id);

    return this.prisma.module.update({
      where: { id },
      data: updateModuleRequest,
      select: moduleSelect,
    });
  }

  async remove(userId: string, id: string): Promise<ModuleDto> {
    await this.findOne(userId, id);

    return this.prisma.module.delete({
      where: { id },
      select: moduleSelect,
    });
  }
}
