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

  async create(createModuleRequest: CreateModule): Promise<ModuleDto> {
    return this.prisma.module.create({
      data: {
        name: createModuleRequest.name,
        description: createModuleRequest.description,
        userId: createModuleRequest.userId,
      },
      select: moduleSelect,
    });
  }

  async findAll({ userId }: { userId: string }): Promise<ModuleDto[]> {
    return this.prisma.module.findMany({
      where: { userId },
      select: moduleSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<ModuleDto> {
    const module = await this.prisma.module.findUnique({
      where: { id },
      select: moduleSelect,
    });

    if (!module) {
      throw new NotFoundException(`Module with id "${id}" was not found`);
    }

    return module;
  }

  async update(
    id: string,
    updateModuleRequest: UpdateModule,
  ): Promise<ModuleDto> {
    await this.findOne(id);

    return this.prisma.module.update({
      where: { id },
      data: updateModuleRequest,
      select: moduleSelect,
    });
  }

  async remove(id: string): Promise<ModuleDto> {
    await this.findOne(id);

    return this.prisma.module.delete({
      where: { id },
      select: moduleSelect,
    });
  }
}
