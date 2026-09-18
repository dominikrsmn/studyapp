import type {
  GraphBuildStatusDto,
  PublishedLearningGraphDto,
} from '@study/contracts';
import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { GraphBuildQueue } from './graph-build.queue';
import type {
  GraphBuildJobData,
  GroupedGraphProposal,
  LearningUnitProposal,
  UnitOrdering,
} from './graph-build.types';
import { graphBuildConfig } from './graph-build.config';
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
    @InjectQueue(graphBuildConfig().queue.name)
    private readonly queue: Queue<GraphBuildJobData>,
  ) {}

  async findLatest(
    semesterId: string,
    moduleId: string,
  ): Promise<GraphBuildStatusDto | null> {
    const module = await this.prismaService.module.findFirst({
      where: { id: moduleId, semesterId },
      select: { graphVersion: true },
    });
    if (!module) throw new NotFoundException('Module was not found');
    const graph = await this.prismaService.learningGraph.findFirst({
      where: { moduleId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true, errorMessage: true },
    });
    return graph
      ? { ...graph, current: graph.version === module.graphVersion }
      : null;
  }

  async requestBuild(
    semesterId: string,
    moduleId: string,
  ): Promise<GraphBuildJobData> {
    const version = await this.prismaService.$transaction(
      async (transaction) => {
        const [module] = await transaction.$queryRaw<
          Array<{ graphVersion: number }>
        >`
        SELECT "graphVersion" FROM "Module"
        WHERE "id" = ${moduleId} AND "semesterId" = ${semesterId} FOR UPDATE`;
        if (!module) throw new NotFoundException('Module was not found');
        const existing = await transaction.learningGraph.findFirst({
          where: { moduleId, version: module.graphVersion },
          select: { status: true },
        });
        if (!existing || existing.status === 'QUEUED')
          return module.graphVersion;
        const updated = await transaction.module.update({
          where: { id: moduleId },
          data: { graphVersion: { increment: 1 } },
          select: { graphVersion: true },
        });
        return updated.graphVersion;
      },
    );
    const build = await this.regenerate(moduleId, version);
    if (!build) {
      throw new ConflictException('Source material changed; start a new build');
    }
    return build;
  }

  async retryPublication(semesterId: string, moduleId: string): Promise<void> {
    const graph = await this.findLatest(semesterId, moduleId);
    if (!graph || !graph.current || graph.status !== 'FAILED') {
      throw new ConflictException(
        'Only a failed build with unchanged source material can be retried',
      );
    }
    const job = await this.queue.getJob(
      `publish-graph/${graph.id}/${graph.version}`,
    );
    const proposals = job
      ? Object.values(
          await job.getChildrenValues<GroupedGraphProposal | null>(),
        )
      : [];
    if (!job || !(await job.isFailed()) || !proposals[0]) {
      throw new ConflictException(
        'No saved publication is available. Regenerate the learning path to start a new build.',
      );
    }
    const data = { graphId: graph.id, moduleId, graphVersion: graph.version };
    await this.prismaService.$transaction(async (transaction) => {
      const modules = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Module"
        WHERE "id" = ${moduleId} AND "graphVersion" = ${graph.version} FOR UPDATE`;
      if (!modules.length)
        throw new ConflictException(
          'Source material changed; start a new build',
        );
      const result = await transaction.learningGraph.updateMany({
        where: { id: graph.id, status: 'FAILED' },
        data: { status: 'QUEUED', finishedAt: null, errorMessage: null },
      });
      if (!result.count)
        throw new ConflictException('This build is already being retried');
    });
    try {
      await job.retry('failed');
      this.logger.log(
        `Retrying saved publication for graph "${graph.id}" without new AI requests`,
      );
    } catch (error) {
      await failQueuedGraphBuild(
        this.prismaService,
        data,
        `Could not retry publication: ${graphBuildErrorMessage(error)}`,
      );
      throw error;
    }
  }

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
        const units = await transaction.$queryRaw<LearningUnitProposal[]>`
          SELECT "id", "title", "summary", "topicIds", "entryTopicId", "exitTopicIds"
          FROM "LearningUnit" WHERE "moduleId" = ${moduleId} ORDER BY "id"`;
        const ordering = await transaction.$queryRaw<UnitOrdering[]>`
          SELECT ordering."sourceUnitId", ordering."destinationUnitId"
          FROM "LearningUnitOrdering" AS ordering
          JOIN "LearningUnit" AS source ON source."id" = ordering."sourceUnitId"
          WHERE source."moduleId" = ${moduleId}
          ORDER BY ordering."sourceUnitId", ordering."destinationUnitId"`;
        return {
          ...graph,
          units,
          ordering,
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
