import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SourceDto } from '@study/contracts';
import type { Prisma } from '../../infrastructure/database/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { IngestionQueue } from '../ingestion/ingestion.queue';

const sourceSelect = {
  id: true,
  name: true,
  mimeType: true,
  moduleId: true,
  processingStages: {
    select: {
      stage: true,
      state: true,
      errorMessage: true,
    },
  },
} as const;

type SourceRecord = Prisma.SourceGetPayload<{ select: typeof sourceSelect }>;

@Injectable()
export class SourceService {
  private readonly logger = new Logger(SourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly sourceIngestionQueue: IngestionQueue,
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

    let uploadedMetadata: SourceDto;
    let sourceCreated = false;
    try {
      await this.fileStorageService.save(source.buffer, sourceId);
      const createdSource = await this.prisma.source.create({
        data: {
          id: sourceId,
          name: source.originalname,
          mimeType: source.mimetype,
          moduleId,
          storageKey: sourceId,
        },
        select: sourceSelect,
      });
      uploadedMetadata = this.toDto(createdSource);
      sourceCreated = true;
      await this.sourceIngestionQueue.addParseDocument(sourceId);
    } catch (error) {
      if (sourceCreated) {
        await this.prisma.source
          .delete({ where: { id: sourceId } })
          .catch((cleanupError) => {
            this.logger.error(
              `Failed to clean up metadata for source "${sourceId}"`,
              cleanupError instanceof Error ? cleanupError.stack : undefined,
            );
          });
      }
      await this.fileStorageService.delete(sourceId).catch((cleanupError) => {
        this.logger.error(
          `Failed to clean up file for source "${sourceId}"`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      });
      throw error;
    }

    return uploadedMetadata;
  }

  async findAll(userId: string, moduleId: string): Promise<SourceDto[]> {
    await this.assertModuleOwnership(userId, moduleId);
    const sources = await this.prisma.source.findMany({
      where: { moduleId },
      select: sourceSelect,
      orderBy: { createdAt: 'desc' },
    });

    return sources.map((source) => this.toDto(source));
  }

  async remove(
    userId: string,
    moduleId: string,
    id: string,
  ): Promise<SourceDto> {
    const source = await this.prisma.source.findFirst({
      where: { id, moduleId, module: { semester: { userId } } },
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
      await this.fileStorageService.deleteMany([source.storageKey]);
    }
    return this.toDto(deletedSource);
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

  private toDto(source: SourceRecord): SourceDto {
    return {
      id: source.id,
      name: source.name,
      mimeType: source.mimeType,
      moduleId: source.moduleId,
      processingStages: source.processingStages,
    };
  }
}
