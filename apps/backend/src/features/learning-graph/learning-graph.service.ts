import type { PublishedLearningGraphDto } from '@study/contracts';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GraphBuildQueue } from './graph-build.queue';
import type { GraphBuildJobData } from './graph-build.types';
import {
  failQueuedGraphBuild,
  graphBuildErrorMessage,
} from './graph-build.outcome';

@Injectable()
export class LearningGraphService {
  private readonly logger = new Logger(LearningGraphService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly graphBuildQueue: GraphBuildQueue,
  ) {}

  async findPublished(
    semesterId: string,
    moduleId: string,
  ): Promise<PublishedLearningGraphDto | null> {
    return this.prismaService.$transaction(
      async (transaction) => {
        const module = await transaction.module.findFirst({
          where: { id: moduleId, semesterId },
          select: { id: true },
        });
        if (!module) {
          throw new NotFoundException(
            `Module with id "${moduleId}" was not found`,
          );
        }

        const graph = await transaction.learningGraph.findFirst({
          where: { moduleId, status: 'COMPLETED' },
          orderBy: { version: 'desc' },
          select: { id: true, version: true },
        });
        if (!graph) return null;

        const topics = await transaction.topic.findMany({
          where: { moduleId, published: true },
          orderBy: { id: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            prerequisites: {
              orderBy: { id: 'asc' },
              select: { id: true },
            },
          },
        });
        return {
          ...graph,
          topics: topics.map(({ prerequisites, ...topic }) => ({
            ...topic,
            prerequisiteIds: prerequisites.map(({ id }) => id),
          })),
        };
      },
      {
        // Keep graph metadata and membership on the same publication during reads.
        isolationLevel: 'RepeatableRead',
      },
    );
  }

  async regenerate(
    moduleId: string,
    graphVersion: number,
  ): Promise<GraphBuildJobData | null> {
    const build = await this.prismaService.$transaction(async (transaction) => {
      // Serialize requests for this version with input changes and publication.
      const modules = await transaction.$queryRaw<
        Array<{ id: string }>
      >`SELECT "id" FROM "Module"
          WHERE "id" = ${moduleId} AND "graphVersion" = ${graphVersion}
          FOR UPDATE`;
      if (modules.length === 0) return null;

      await transaction.learningGraph.updateMany({
        where: {
          moduleId,
          version: { lt: graphVersion },
          status: 'QUEUED',
        },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: `Superseded by graph version ${graphVersion}`,
        },
      });

      const existing = await transaction.learningGraph.findFirst({
        where: { moduleId, version: graphVersion },
        select: { id: true, status: true },
      });
      const graph =
        existing ??
        (await transaction.learningGraph.create({
          data: { moduleId, version: graphVersion, status: 'QUEUED' },
          select: { id: true, status: true },
        }));
      return {
        data: { graphId: graph.id, moduleId, graphVersion },
        queued: graph.status === 'QUEUED',
      };
    });

    if (!build) return null;
    if (build.queued) {
      try {
        await this.graphBuildQueue.addEmbeddingFlow(build.data);
      } catch (error) {
        try {
          await failQueuedGraphBuild(
            this.prismaService,
            build.data,
            `Failed to enqueue graph build: ${graphBuildErrorMessage(error)}`,
          );
        } catch (persistenceError) {
          this.logger.error(
            `Failed to persist enqueue failure for graph "${build.data.graphId}": ${graphBuildErrorMessage(persistenceError)}`,
            persistenceError instanceof Error
              ? persistenceError.stack
              : undefined,
          );
        }
        throw error;
      }
    }
    return build.data;
  }
}
