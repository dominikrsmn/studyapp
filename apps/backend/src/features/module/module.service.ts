import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateModule,
  ModuleDto,
  UpdateModule} from '@study/contracts';
import {
  dateOnly
} from '@study/contracts';
import type { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import type { Module } from '../../infrastructure/database/generated/client';
import type { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async create(
    semesterId: string,
    createModuleRequest: CreateModule,
  ): Promise<ModuleDto> {
    return this.toDto(
      await this.prisma.module.create({
        data: {
          name: createModuleRequest.name,
          description: createModuleRequest.description,
          icon: createModuleRequest.icon,
          semesterId,
          examDate: createModuleRequest.examDate
            ? dateOnly.toPrisma(createModuleRequest.examDate)
            : null,
        },
      }),
    );
  }

  async findAll(semesterId: string): Promise<ModuleDto[]> {
    const modules = await this.prisma.module.findMany({
      where: { semesterId },
      orderBy: { createdAt: 'desc' },
    });

    return modules.map((module) => this.toDto(module));
  }

  async findOne(semesterId: string, id: string): Promise<ModuleDto> {
    const module = await this.prisma.module.findFirst({
      where: { id, semesterId },
    });

    if (!module) {
      throw new NotFoundException(`Module with id "${id}" was not found`);
    }

    return this.toDto(module);
  }

  async update(
    semesterId: string,
    id: string,
    updateModuleRequest: UpdateModule,
  ): Promise<ModuleDto> {
    await this.findOne(semesterId, id);

    const { examDate, ...data } = updateModuleRequest;

    return this.toDto(
      await this.prisma.module.update({
        where: { id },
        data: {
          ...data,
          examDate:
            examDate === undefined
              ? undefined
              : examDate === null
                ? null
                : dateOnly.toPrisma(examDate),
        },
      }),
    );
  }

  async remove(semesterId: string, id: string): Promise<ModuleDto> {
    const module = await this.findOne(semesterId, id);
    const sources = await this.prisma.source.findMany({
      where: { moduleId: id },
      select: { storageKey: true },
    });

    await this.prisma.module.delete({ where: { id } });
    await this.fileStorageService.deleteMany(
      sources.flatMap(({ storageKey }) => (storageKey ? [storageKey] : [])),
    );

    return module;
  }

  private toDto(module: Module): ModuleDto {
    return {
      id: module.id,
      name: module.name,
      description: module.description,
      icon: module.icon,
      examDate: module.examDate
        ? dateOnly.fromPrisma(module.examDate)
        : undefined,
    };
  }
}
