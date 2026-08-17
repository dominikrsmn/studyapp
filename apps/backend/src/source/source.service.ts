import { Injectable, NotFoundException } from '@nestjs/common';
import { SourceDto } from '@study/contracts';
import { PrismaService } from '../database/prisma/prisma.service';
import { join } from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { FileStorageService } from '../filestorage/filestorage.service';

const sourceSelect = {
  id: true,
  name: true,
  type: true,
  mimeType: true,
  status: true,
  moduleId: true,
} as const;

@Injectable()
export class SourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async uploadSource(
    userId: string,
    moduleId: string,
    source: Express.Multer.File,
  ): Promise<SourceDto> {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, semester: { userId } },
      select: { id: true },
    });

    if (!module) {
      throw new NotFoundException(`Module with id "${moduleId}" was not found`);
    }
    const sourceId = randomUUID();

    this.fileStorageService.save(source.buffer, sourceId);

    let uploadedMetadata: SourceDto;
    try {
      uploadedMetadata = await this.prisma.source.create({
        data: {
          id: sourceId,
          name: source.originalname,
          type: 'DOCUMENT',
          mimeType: source.mimetype,
          moduleId,
          storageKey: sourceId,
        },
        select: sourceSelect,
      });
    } catch (error) {
      await this.fileStorageService.delete(sourceId);
      throw error;
    }

    return uploadedMetadata;
  }

  async findAll(userId: string, moduleId: string): Promise<SourceDto[]> {
    await this.assertModuleOwnership(userId, moduleId);
    return this.prisma.source.findMany({
      where: { moduleId },
      select: sourceSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string): Promise<SourceDto> {
    const source = await this.prisma.source.findFirst({
      where: { id, module: { semester: { userId } } },
      select: { ...sourceSelect, storageKey: true },
    });
    if (!source) {
      throw new NotFoundException(`Source with id "${id}" was not found`);
    }
    const deletedSource = await this.prisma.source.delete({
      where: { id },
      select: sourceSelect,
    });
    if (source.storageKey) {
      await unlink(join(process.cwd(), 'uploads', source.storageKey)).catch(
        () => undefined,
      );
    }
    return deletedSource;
  }

  private async assertModuleOwnership(
    userId: string,
    moduleId: string,
  ): Promise<void> {
    const module = await this.prisma.module.findFirst({
      where: { id: moduleId, semester: { userId } },
      select: { id: true },
    });
    if (!module) {
      throw new NotFoundException(`Module with id "${moduleId}" was not found`);
    }
  }
}
