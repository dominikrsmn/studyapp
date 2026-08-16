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
    semesterId: string,
    createModuleRequest: CreateModule,
  ): Promise<ModuleDto> {
    return this.prisma.module.create({
      data: {
        name: createModuleRequest.name,
        description: createModuleRequest.description,
        semesterId,
      },
      select: moduleSelect,
    });
  }

  async findAll(semesterId: string): Promise<ModuleDto[]> {
    return this.prisma.module.findMany({
      where: { semesterId },
      select: moduleSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(semesterId: string, id: string): Promise<ModuleDto> {
    const module = await this.prisma.module.findFirst({
      where: { id, semesterId },
      select: moduleSelect,
    });

    if (!module) {
      throw new NotFoundException(`Module with id "${id}" was not found`);
    }

    return module;
  }

  async update(
    semesterId: string,
    id: string,
    updateModuleRequest: UpdateModule,
  ): Promise<ModuleDto> {
    await this.findOne(semesterId, id);

    return this.prisma.module.update({
      where: { id },
      data: updateModuleRequest,
      select: moduleSelect,
    });
  }

  async remove(semesterId: string, id: string): Promise<ModuleDto> {
    await this.findOne(semesterId, id);

    return this.prisma.module.delete({
      where: { id },
      select: moduleSelect,
    });
  }
}
