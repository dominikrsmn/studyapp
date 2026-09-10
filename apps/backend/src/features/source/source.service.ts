import { LearningGraphService } from '../learning-graph/learning-graph.service';
import { Decimal } from '@prisma/client/runtime/client';
import { invalidateSourceTopics } from '../topic/content-revision';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SourceDto, SourceJobsDto } from '@study/contracts';
import type { Prisma } from '../../infrastructure/database/generated/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { randomUUID } from 'node:crypto';
import { FileStorageService } from '../../infrastructure/filestorage/filestorage.service';
import { IngestionQueue } from '../source-ingestion/ingestion.queue';
import { SourceProcessingStageService } from '../source-ingestion/source-processing-stage.service';

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
    private readonly sourceProcessingStageService: SourceProcessingStageService,
    private readonly learningGraphService: LearningGraphService,
  ) {}

  async getJobs(
    userId: string,
    moduleId: string,
    sourceId: string,
  ): Promise<SourceJobsDto> {
    const source = await this.prisma.source.findFirst({
      where: { id: sourceId, moduleId, module: { semester: { userId } } },
      select: sourceSelect,
    });
    if (!source) throw new NotFoundException('Source was not found');
    const executions = await this.prisma.sourceJob.findMany({
      where: { sourceIds: { has: sourceId } },
      orderBy: { startedAt: 'asc' },
      include: { costs: { select: { costUsd: true } } },
    });
    const jobs = executions.map((job) => ({
      id: job.id,
      name: job.name,
      attempt: job.attempt,
      state: job.state,
      startedAt: job.startedAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
      costUsd: job.costs.length
        ? job.costs
            .reduce((sum, cost) => sum.plus(cost.costUsd), new Decimal(0))
            .toFixed(8)
        : null,
      shared: job.sourceIds.length > 1,
    }));
    const recorded = jobs.filter((job) => job.costUsd !== null);
    return {
      jobs,
      recordedCostUsd: recorded.length
        ? recorded
            .reduce((sum, job) => sum.plus(job.costUsd!), new Decimal(0))
            .toFixed(8)
        : null,
      processingStages: source.processingStages,
    };
  }

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
      await this.prisma.source.create({
        data: {
          id: sourceId,
          name: source.originalname,
          mimeType: source.mimetype,
          moduleId,
          storageKey: sourceId,
        },
        select: sourceSelect,
      });
      sourceCreated = true;
      await this.sourceProcessingStageService.initialize(sourceId);
      await this.sourceIngestionQueue.addParseDocument(sourceId);
      const queuedSource = await this.prisma.source.findUnique({
        where: { id: sourceId },
        select: sourceSelect,
      });
      if (!queuedSource) {
        throw new Error(
          `Source "${sourceId}" disappeared while it was being queued`,
        );
      }
      uploadedMetadata = this.toDto(queuedSource);
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
    const { deletedSource, graphBuild } = await this.prisma.$transaction(
      async (transaction) => {
        const graphBuild = await invalidateSourceTopics(transaction, id);
        const deletedSource = await transaction.source.delete({
          where: { id },
          select: sourceSelect,
        });
        return { deletedSource, graphBuild };
      },
      { isolationLevel: 'Serializable' },
    );
    await this.learningGraphService.regenerate(
      moduleId,
      graphBuild.graphVersion,
    );
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
